// binding.cc — N-API addon: direct DeviceIoControl to cscdc.sys.
//
// Flow REPLICATES the observed Java app behavior (API hook, 2026-10-14):
//   main handle: CreateFile -> 0x6C(init) -> 0x06(get desc) -> 0x24(set config)
//   pipe handle: CreateFile -> 0x6C(init) -> 0x78(bind, 1-byte ep)
//   I/O: ReadFile/WriteFile on the pipe handle (overlapped + timeout)
//
// JS API:
//   const usbio = require('./build/Release/usbio.node');
//   const devs = usbio.createDeviceList();      // [devicePath, ...]
//   const dev = usbio.openDevice(devs[0]);      // main handle id
//   usbio.getDeviceDescriptor(dev);             // { idVendor, idProduct }
//   usbio.setConfiguration(dev);                // true (best-effort, like Java)
//   const out = usbio.openPipe(devs[0], 0x01);  // pipe handle id
//   const inp = usbio.openPipe(devs[0], 0x82);
//   usbio.writePipe(out, frame, 100);           // bytes written
//   const buf = usbio.readPipe(inp, 1024, 1000);// Buffer
//   usbio.close(out); usbio.close(inp); usbio.close(dev);
//
// Build (Windows): npm install  (needs VS Build Tools + node-gyp)

#include <napi.h>
#include <windows.h>
#include <setupapi.h>
#include <cstdio>
#include <map>
#include "usbio_ioctl.h"

static std::map<int, HANDLE> g_handles;
static int g_nextId = 1;

static HANDLE H(int id) {
    auto it = g_handles.find(id);
    return it == g_handles.end() ? INVALID_HANDLE_VALUE : it->second;
}

static int storeHandle(HANDLE h) {
    int id = g_nextId++;
    g_handles[id] = h;
    return id;
}

// initDevice: DeviceIoControl(0x6C), no input, 12 bytes output (ignored).
static bool initDevice(HANDLE h) {
    unsigned char out[12] = {};
    DWORD ret = 0;
    return DeviceIoControl(h, IOCTL_USBIO_INIT_DEVICE, NULL, 0,
                           out, sizeof(out), &ret, NULL);
}

static Napi::Value CreateDeviceList(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Array out = Napi::Array::New(env);
    HDEVINFO devs = SetupDiGetClassDevsW(&GUID_USBIO_IFACE, NULL, NULL,
                                         DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
    if (devs == INVALID_HANDLE_VALUE) {
        Napi::Error::New(env, "SetupDiGetClassDevs failed").ThrowAsJavaScriptException();
        return out;
    }
    SP_DEVICE_INTERFACE_DATA ifd = {};
    ifd.cbSize = sizeof(ifd);
    uint32_t n = 0;
    for (DWORD i = 0; SetupDiEnumDeviceInterfaces(devs, NULL, &GUID_USBIO_IFACE, i, &ifd); i++) {
        DWORD need = 0;
        SetupDiGetDeviceInterfaceDetailW(devs, &ifd, NULL, 0, &need, NULL);
        auto det = (PSP_DEVICE_INTERFACE_DETAIL_DATA_W)malloc(need);
        if (!det) break;
        det->cbSize = sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W);
        if (SetupDiGetDeviceInterfaceDetailW(devs, &ifd, det, need, NULL, NULL))
            out.Set(n++, Napi::String::New(env, (const char16_t*)det->DevicePath));
        free(det);
        if (env.IsExceptionPending()) break;
    }
    SetupDiDestroyDeviceInfoList(devs);
    return out;
}

// openDevice(path): main handle — CreateFile + 0x6C init.
static Napi::Value OpenDevice(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::u16string path = info[0].As<Napi::String>().Utf16Value();
    HANDLE h = CreateFileW((LPCWSTR)path.c_str(), GENERIC_READ | GENERIC_WRITE,
                           FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                           OPEN_EXISTING, FILE_FLAG_OVERLAPPED, NULL);
    if (h == INVALID_HANDLE_VALUE) {
        Napi::Error::New(env, "CreateFile failed: " + std::to_string(GetLastError()))
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!initDevice(h)) {
        DWORD err = GetLastError();
        CloseHandle(h);
        Napi::Error::New(env, "INIT_DEVICE (0x6C) failed: " + std::to_string(err))
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    return Napi::Number::New(env, storeHandle(h));
}

// openPipe(path, epAddr): pipe handle — CreateFile + 0x6C init + 0x78 bind.
static Napi::Value OpenPipe(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::u16string path = info[0].As<Napi::String>().Utf16Value();
    UCHAR ep = (UCHAR)info[1].As<Napi::Number>().Int32Value();
    HANDLE h = CreateFileW((LPCWSTR)path.c_str(), GENERIC_READ | GENERIC_WRITE,
                           FILE_SHARE_READ | FILE_SHARE_WRITE, NULL,
                           OPEN_EXISTING, FILE_FLAG_OVERLAPPED, NULL);
    if (h == INVALID_HANDLE_VALUE) {
        Napi::Error::New(env, "CreateFile failed: " + std::to_string(GetLastError()))
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    if (!initDevice(h)) {
        DWORD err = GetLastError();
        CloseHandle(h);
        Napi::Error::New(env, "pipe INIT_DEVICE failed: " + std::to_string(err))
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    DWORD ret = 0;
    // BIND_PIPE: 1-byte input = endpoint address (observed ground truth).
    if (!DeviceIoControl(h, IOCTL_USBIO_BIND_PIPE, &ep, 1, NULL, 0, &ret, NULL)) {
        DWORD err = GetLastError();
        CloseHandle(h);
        Napi::Error::New(env, "BIND_PIPE failed: " + std::to_string(err))
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }
    return Napi::Number::New(env, storeHandle(h));
}

static Napi::Value GetDeviceDescriptor(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    HANDLE h = H(info[0].As<Napi::Number>().Int32Value());
    // NOTE: output buffer must be exactly 18 bytes (USB_DEVICE_DESCRIPTOR size).
    // Larger buffers cause the driver to truncate the reply to 8 bytes.
    unsigned char out[18] = {};
    DWORD ret = 0;
    BOOL ok = DeviceIoControl(h, IOCTL_USBIO_GET_DESCRIPTOR,
                     (LPVOID)GET_DEVICE_DESCRIPTOR_REQ, sizeof(GET_DEVICE_DESCRIPTOR_REQ),
                     out, sizeof(out), &ret, NULL);
    // Validate by content: bLength=0x12, bDescriptorType=0x01.
    if (!ok || out[0] != 0x12 || out[1] != 0x01) {
        DWORD err = GetLastError();
        char msg[256];
        int n = snprintf(msg, sizeof(msg), "GET_DESCRIPTOR failed: ok=%d err=%lu ret=%lu out=",
                 (int)ok, err, ret);
        for (DWORD i = 0; i < ret && n < (int)sizeof(msg) - 4; i++)
            n += snprintf(msg + n, sizeof(msg) - n, "%02X ", out[i]);
        Napi::Error::New(env, msg).ThrowAsJavaScriptException();
        return env.Undefined();
    }
    Napi::Object o = Napi::Object::New(env);
    o.Set("idVendor", (uint16_t)(out[8] | (out[9] << 8)));
    o.Set("idProduct", (uint16_t)(out[10] | (out[11] << 8)));
    o.Set("bcdDevice", (uint16_t)(out[12] | (out[13] << 8)));
    o.Set("bNumConfigurations", out[17]);
    return o;
}

// Best-effort like the Java app (which ignores setConfiguration failure).
static Napi::Value SetConfiguration(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    HANDLE h = H(info[0].As<Napi::Number>().Int32Value());
    USBIO_SET_CONFIG conf;
    build_ds300_set_config(&conf);
    DWORD ret = 0;
    BOOL ok = DeviceIoControl(h, IOCTL_USBIO_SET_CONFIGURATION,
                              &conf, sizeof(conf), NULL, 0, &ret, NULL);
    return Napi::Boolean::New(env, ok);
}

// GET_CONFIGURATION_INFO (0x50): no input, 776-byte output.
// Returns the raw buffer so JS can parse endpoint descriptors.
static Napi::Value GetConfigurationInfo(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    HANDLE h = H(info[0].As<Napi::Number>().Int32Value());
    Napi::Buffer<unsigned char> out = Napi::Buffer<unsigned char>::New(env, 776);
    DWORD ret = 0;
    BOOL ok = DeviceIoControl(h, IOCTL_USBIO_GET_CONFIG_INFO, NULL, 0,
                             out.Data(), 776, &ret, NULL);
    if (!ok) {
        Napi::Error::New(env, "GET_CONFIGURATION_INFO failed").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    return Napi::Buffer<unsigned char>::Copy(env, out.Data(), ret);
}

static Napi::Value WritePipe(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    HANDLE h = H(info[0].As<Napi::Number>().Int32Value());
    Napi::Buffer<unsigned char> buf = info[1].As<Napi::Buffer<unsigned char>>();
    DWORD timeout = info.Length() > 2 ? info[2].As<Napi::Number>().Uint32Value() : 100;
    OVERLAPPED ov = {};
    ov.hEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
    DWORD written = 0;
    BOOL r = WriteFile(h, buf.Data(), (DWORD)buf.Length(), NULL, &ov);
    DWORD err = GetLastError();
    if (!r && err == ERROR_IO_PENDING) {
        if (WaitForSingleObject(ov.hEvent, timeout) == WAIT_OBJECT_0) {
            if (!GetOverlappedResult(h, &ov, &written, FALSE)) {
                err = GetLastError();
                CloseHandle(ov.hEvent);
                Napi::Error::New(env, "WriteFile failed: " + std::to_string(err))
                    .ThrowAsJavaScriptException();
                return env.Undefined();
            }
        } else {
            CancelIo(h);
            GetOverlappedResult(h, &ov, &written, TRUE);
            CloseHandle(ov.hEvent);
            Napi::Error::New(env, "WriteFile timeout").ThrowAsJavaScriptException();
            return env.Undefined();
        }
    } else if (!r) {
        CloseHandle(ov.hEvent);
        Napi::Error::New(env, "WriteFile failed: " + std::to_string(err))
            .ThrowAsJavaScriptException();
        return env.Undefined();
    } else {
        GetOverlappedResult(h, &ov, &written, FALSE);
    }
    CloseHandle(ov.hEvent);
    return Napi::Number::New(env, written);
}

static Napi::Value ReadPipe(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    HANDLE h = H(info[0].As<Napi::Number>().Int32Value());
    size_t len = info[1].As<Napi::Number>().Int64Value();
    DWORD timeout = info.Length() > 2 ? info[2].As<Napi::Number>().Uint32Value() : 1000;
    Napi::Buffer<unsigned char> out = Napi::Buffer<unsigned char>::New(env, len);
    OVERLAPPED ov = {};
    ov.hEvent = CreateEvent(NULL, TRUE, FALSE, NULL);
    DWORD got = 0;
    BOOL r = ReadFile(h, out.Data(), (DWORD)len, NULL, &ov);
    DWORD err = GetLastError();
    if (!r && err == ERROR_IO_PENDING) {
        if (WaitForSingleObject(ov.hEvent, timeout) == WAIT_OBJECT_0)
            GetOverlappedResult(h, &ov, &got, FALSE);
        else {
            CancelIo(h);
            GetOverlappedResult(h, &ov, &got, TRUE);
            got = 0;
        }
    } else if (r) {
        GetOverlappedResult(h, &ov, &got, FALSE);
    }
    CloseHandle(ov.hEvent);
    return Napi::Buffer<unsigned char>::Copy(env, out.Data(), got);
}

static Napi::Value Close(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    int id = info[0].As<Napi::Number>().Int32Value();
    auto it = g_handles.find(id);
    if (it != g_handles.end()) {
        CloseHandle(it->second);
        g_handles.erase(it);
    }
    return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("createDeviceList", Napi::Function::New(env, CreateDeviceList));
    exports.Set("openDevice", Napi::Function::New(env, OpenDevice));
    exports.Set("openPipe", Napi::Function::New(env, OpenPipe));
    exports.Set("getDeviceDescriptor", Napi::Function::New(env, GetDeviceDescriptor));
    exports.Set("getConfigurationInfo", Napi::Function::New(env, GetConfigurationInfo));
    exports.Set("setConfiguration", Napi::Function::New(env, SetConfiguration));
    exports.Set("writePipe", Napi::Function::New(env, WritePipe));
    exports.Set("readPipe", Napi::Function::New(env, ReadPipe));
    exports.Set("close", Napi::Function::New(env, Close));
    return exports;
}

NODE_API_MODULE(usbio, Init)
