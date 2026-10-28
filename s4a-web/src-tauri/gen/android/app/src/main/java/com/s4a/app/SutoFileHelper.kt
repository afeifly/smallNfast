package com.s4a.app

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import java.io.File
import java.io.FileOutputStream

object SutoFileHelper {
    private const val TAG = "SutoFileHelper"
    private var appContext: Context? = null

    @JvmStatic
    fun init(context: Context) {
        appContext = context.applicationContext
    }

    @JvmStatic
    fun saveBinaryFile(filename: String, data: ByteArray): String? {
        val ctx = appContext ?: return null
        var cleanName = filename.replace(':', '_').replace('/', '_').replace('\\', '_')
        if (cleanName.lowercase().endsWith(".png.bmp")) {
            cleanName = cleanName.substring(0, cleanName.length - 4)
        }

        val ext = cleanName.substringAfterLast('.', "").lowercase()
        val mimeType = when (ext) {
            "csv" -> "text/csv"
            "csd" -> "application/octet-stream"
            "pdf" -> "application/pdf"
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "bmp" -> "image/bmp"
            "xlsx", "xls" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            else -> "application/octet-stream"
        }

        try {
            // Android 10+ (API 29+): Use MediaStore to save directly into Downloads/SUTO
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val resolver = ctx.contentResolver
                val contentValues = ContentValues().apply {
                    put(MediaStore.MediaColumns.DISPLAY_NAME, cleanName)
                    put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
                    put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/SUTO")
                }

                val uri: Uri? = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                if (uri != null) {
                    resolver.openOutputStream(uri)?.use { out ->
                        out.write(data)
                        out.flush()
                    }
                    val displayPath = "Download/SUTO/$cleanName"
                    Log.i(TAG, "File successfully saved to MediaStore: $displayPath (uri: $uri)")
                    return displayPath
                }
            }

            // Fallback for Android 9 and lower, or if MediaStore insert returned null:
            // 1. Try public Downloads directory
            val pubDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            val sutoDir = File(pubDownloads, "SUTO")
            if (!sutoDir.exists()) {
                sutoDir.mkdirs()
            }
            if (sutoDir.exists() && (sutoDir.canWrite() || Build.VERSION.SDK_INT < Build.VERSION_CODES.Q)) {
                val outFile = File(sutoDir, cleanName)
                FileOutputStream(outFile).use { fos ->
                    fos.write(data)
                    fos.flush()
                }
                // Notify system media scanner so the file shows up immediately in Downloads app
                MediaScannerConnection.scanFile(ctx, arrayOf(outFile.absolutePath), arrayOf(mimeType), null)
                val displayPath = "Download/SUTO/$cleanName"
                Log.i(TAG, "File successfully saved to public Downloads: $displayPath")
                return displayPath
            }

            // 2. Fallback to app-specific external files dir (always writable without runtime permissions)
            val appDownloads = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: ctx.filesDir
            val outFile = File(appDownloads, cleanName)
            FileOutputStream(outFile).use { fos ->
                fos.write(data)
                fos.flush()
            }
            Log.i(TAG, "File saved to app files dir: ${outFile.absolutePath}")
            return outFile.absolutePath
        } catch (e: Exception) {
            Log.e(TAG, "Error saving file $cleanName: ${e.message}", e)
            return null
        }
    }
}

