// usbio_ioctl.h — IOCTL numbers + SET_CONFIGURATION blob for cscdc.sys (USBIO).
// Ground truth from API hook on working Java app, 2026-10-14.

#pragma once
#include <windows.h>
#include <cstring>

// ---- IOCTL numbers (from API hook) ----
#define IOCTL_USBIO_INIT_DEVICE        0x8094206C  // per-handle init, no in, 12 bytes out
#define IOCTL_USBIO_GET_DESCRIPTOR     0x80942006  // 8-byte req in, 18-byte device desc out
#define IOCTL_USBIO_SET_CONFIGURATION  0x80942024  // 260-byte USBIO_SET_CONFIGURATION in
#define IOCTL_USBIO_GET_CONFIG_INFO    0x80942050  // no in, 776-byte info out (optional)
#define IOCTL_USBIO_BIND_PIPE          0x80942078  // 1-byte endpoint address in
// NOTE: 0x809420C8 (earlier "ACQUIRE" guess) is NOT used by the Java app.

// ---- GET_DESCRIPTOR request (8 bytes, replicate exactly) ----
// Observed: 00 00 00 00 01 00 00 00  -> device descriptor, index 0
static const unsigned char GET_DEVICE_DESCRIPTOR_REQ[8] =
    { 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00 };

// ---- SET_CONFIGURATION (260 bytes) ----
// struct { USHORT CfgIdx; USHORT NbIf; struct { USHORT IfIdx, Alt; ULONG MaxXfer; } List[32]; }
// This version WORKED at 19:01 (2026-10-14). Do not "fix" based on hook bytes
// without verifying — the hook's 64-byte truncation may mislead.
#define USBIO_MAX_INTERFACES 32
#pragma pack(push, 1)
typedef struct _USBIO_IFACE_SETTING {
    USHORT InterfaceIndex;
    USHORT AlternateSettingIndex;
    ULONG  MaximumTransferSize;
} USBIO_IFACE_SETTING;
typedef struct _USBIO_SET_CONFIG {
    USHORT CfgIndex;
    USHORT NbOfInterfaces;
    USBIO_IFACE_SETTING List[USBIO_MAX_INTERFACES];
} USBIO_SET_CONFIG;
#pragma pack(pop)

// Interface GUID {325ddf96-938c-11d3-9e34-0080c82727f4}
static const GUID GUID_USBIO_IFACE =
    { 0x325ddf96, 0x938c, 0x11d3, { 0x9e, 0x34, 0x00, 0x80, 0xc8, 0x27, 0x27, 0xf4 } };

// Build the 260-byte SET_CONFIGURATION blob for DS300.
// Values from USBDS300.java: CfgIndex=0, NbIf=2, If0/If1 with MaxXfer=64.
static void build_ds300_set_config(USBIO_SET_CONFIG* out) {
    memset(out, 0, sizeof(*out));
    out->CfgIndex = 0;
    out->NbOfInterfaces = 2;
    out->List[0].InterfaceIndex = 0;
    out->List[0].AlternateSettingIndex = 0;
    out->List[0].MaximumTransferSize = 64;
    out->List[1].InterfaceIndex = 1;
    out->List[1].AlternateSettingIndex = 0;
    out->List[1].MaximumTransferSize = 64;
}
