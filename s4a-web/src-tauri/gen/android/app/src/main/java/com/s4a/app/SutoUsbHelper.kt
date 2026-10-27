package com.s4a.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.*
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

object SutoUsbHelper {
    private const val TAG = "SutoUsbHelper"
    private const val ACTION_USB_PERMISSION = "com.s4a.app.USB_PERMISSION"

    // Known SUTO USB VID
    private const val SUTO_VID = 0x16C0 // 5824

    private var currentConnection: UsbDeviceConnection? = null
    private var currentInterface: UsbInterface? = null
    private var endpointIn: UsbEndpoint? = null
    private var endpointOut: UsbEndpoint? = null

    private var appContext: Context? = null

    @JvmStatic
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    @JvmStatic
    fun listDevices(): String {
        val ctx = appContext ?: return ""
        val usbManager = ctx.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return ""
        val deviceList = usbManager.deviceList
        val results = mutableListOf<String>()

        for ((_, device) in deviceList) {
            val isSuto = (device.vendorId == SUTO_VID)
            val desc = "${device.deviceName} | VID:0x${Integer.toHexString(device.vendorId)} PID:0x${Integer.toHexString(device.productId)} (${device.productName ?: if (isSuto) "SUTO Sensor" else "USB Device"})"
            results.add(desc)
        }
        return results.joinToString("\n")
    }

    @JvmStatic
    fun openDevice(deviceName: String?): String? {
        val ctx = appContext ?: return "Application context not initialized"
        val usbManager = ctx.getSystemService(Context.USB_SERVICE) as? UsbManager ?: return "USB Service unavailable"
        val deviceList = usbManager.deviceList

        if (deviceList.isEmpty()) {
            return "No USB devices detected. Please connect SUTO hardware using a USB-C OTG cable."
        }

        var targetDevice: UsbDevice? = null
        if (!deviceName.isNullOrBlank()) {
            for ((name, dev) in deviceList) {
                if (name == deviceName || deviceName.contains(name) || deviceName.contains("0x" + Integer.toHexString(dev.vendorId))) {
                    targetDevice = dev
                    break
                }
            }
        }

        if (targetDevice == null) {
            // Match SUTO VID 0x16C0
            for ((_, dev) in deviceList) {
                if (dev.vendorId == SUTO_VID) {
                    targetDevice = dev
                    break
                }
            }
        }

        if (targetDevice == null) {
            // Fallback to first available USB device
            targetDevice = deviceList.values.firstOrNull()
        }

        if (targetDevice == null) {
            return "No matching USB device found."
        }

        // Request permission if not already granted
        if (!usbManager.hasPermission(targetDevice)) {
            val latch = CountDownLatch(1)
            var permissionGranted = false

            val receiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    if (intent?.action == ACTION_USB_PERMISSION) {
                        val dev: UsbDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
                        }
                        if (intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) {
                            if (dev == null || dev.deviceId == targetDevice.deviceId) {
                                permissionGranted = true
                            }
                        }
                        latch.countDown()
                    }
                }
            }

            val filter = IntentFilter(ACTION_USB_PERMISSION)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_MUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val permissionIntent = PendingIntent.getBroadcast(
                ctx,
                0,
                Intent(ACTION_USB_PERMISSION).setPackage(ctx.packageName),
                flags
            )

            ContextCompat.registerReceiver(
                ctx,
                receiver,
                filter,
                ContextCompat.RECEIVER_EXPORTED
            )

            try {
                usbManager.requestPermission(targetDevice, permissionIntent)
                latch.await(12, TimeUnit.SECONDS)
            } catch (e: Exception) {
                Log.w(TAG, "USB permission wait error: ${e.message}")
            } finally {
                try {
                    ctx.unregisterReceiver(receiver)
                } catch (_: Exception) {}
            }

            if (!permissionGranted && !usbManager.hasPermission(targetDevice)) {
                return "USB permission denied by user."
            }
        }

        // Open device
        val connection = usbManager.openDevice(targetDevice)
            ?: return "Failed to open USB device: OS could not establish connection."

        closeDevice()

        // Discover interface with Bulk IN and Bulk OUT endpoints
        var foundInterface: UsbInterface? = null
        var foundIn: UsbEndpoint? = null
        var foundOut: UsbEndpoint? = null

        for (i in 0 until targetDevice.interfaceCount) {
            val iface = targetDevice.getInterface(i)
            var epIn: UsbEndpoint? = null
            var epOut: UsbEndpoint? = null

            for (j in 0 until iface.endpointCount) {
                val ep = iface.getEndpoint(j)
                if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                    if (ep.direction == UsbConstants.USB_DIR_IN) {
                        epIn = ep
                    } else if (ep.direction == UsbConstants.USB_DIR_OUT) {
                        epOut = ep
                    }
                }
            }

            if (epIn != null && epOut != null) {
                foundInterface = iface
                foundIn = epIn
                foundOut = epOut
                break
            }
        }

        if (foundInterface == null && targetDevice.interfaceCount > 0) {
            val iface = targetDevice.getInterface(0)
            for (j in 0 until iface.endpointCount) {
                val ep = iface.getEndpoint(j)
                if (ep.direction == UsbConstants.USB_DIR_IN && foundIn == null) foundIn = ep
                if (ep.direction == UsbConstants.USB_DIR_OUT && foundOut == null) foundOut = ep
            }
            if (foundIn != null && foundOut != null) {
                foundInterface = iface
            }
        }

        if (foundInterface == null || foundIn == null || foundOut == null) {
            connection.close()
            return "Could not identify Bulk IN/OUT endpoints on USB device (interfaces: ${targetDevice.interfaceCount})."
        }

        if (!connection.claimInterface(foundInterface, true)) {
            connection.close()
            return "Failed to claim USB interface ${foundInterface.id}."
        }

        currentConnection = connection
        currentInterface = foundInterface
        endpointIn = foundIn
        endpointOut = foundOut

        Log.i(TAG, "SUTO USB OTG connected! IN=0x${Integer.toHexString(foundIn.address)}, OUT=0x${Integer.toHexString(foundOut.address)}")
        return null // Success
    }

    @JvmStatic
    fun writeData(data: ByteArray, timeoutMs: Int): Int {
        val conn = currentConnection ?: return -1
        val ep = endpointOut ?: return -1
        return conn.bulkTransfer(ep, data, data.size, timeoutMs)
    }

    @JvmStatic
    fun readData(buffer: ByteArray, timeoutMs: Int): Int {
        val conn = currentConnection ?: return -1
        val ep = endpointIn ?: return -1
        return conn.bulkTransfer(ep, buffer, buffer.size, timeoutMs)
    }

    @JvmStatic
    fun closeDevice() {
        try {
            currentInterface?.let { currentConnection?.releaseInterface(it) }
            currentConnection?.close()
        } catch (e: Exception) {
            Log.w(TAG, "Error closing USB connection", e)
        } finally {
            currentConnection = null
            currentInterface = null
            endpointIn = null
            endpointOut = null
        }
    }

    @JvmStatic
    fun isOpen(): Boolean {
        return currentConnection != null
    }
}
