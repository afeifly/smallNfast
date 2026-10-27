package com.s4a.app

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  private external fun initBtleplug()

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    SutoUsbHelper.init(this)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.attributes.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }

    ViewCompat.setOnApplyWindowInsetsListener(window.decorView) { _, insets ->
      updateSafeAreaInsets()
      insets
    }

    window.decorView.postDelayed({ updateSafeAreaInsets() }, 600)
    window.decorView.postDelayed({ updateSafeAreaInsets() }, 1500)

    try {
      initBtleplug()
    } catch (e: Throwable) {
      android.util.Log.w("MainActivity", "initBtleplug error: ${e.message}")
    }
    requestBluetoothPermissions()
  }

  override fun onResume() {
    super.onResume()
    updateSafeAreaInsets()
    requestBluetoothPermissions()
  }

  private fun updateSafeAreaInsets() {
    val insets = ViewCompat.getRootWindowInsets(window.decorView) ?: return
    val statusBar = insets.getInsets(
      WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.displayCutout()
    )
    val navBar = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
    val density = resources.displayMetrics.density
    val topDp = (statusBar.top / density).toInt()
    val bottomDp = (navBar.bottom / density).toInt()

    findWebView(window.decorView)?.let { wv ->
      wv.post {
        wv.evaluateJavascript(
          "document.documentElement.style.setProperty('--safe-area-top', '${topDp}px'); document.documentElement.style.setProperty('--safe-area-bottom', '${bottomDp}px');",
          null
        )
      }
    }
  }

  private fun findWebView(root: View): WebView? {
    if (root is WebView) return root
    if (root is ViewGroup) {
      for (i in 0 until root.childCount) {
        val child = findWebView(root.getChildAt(i))
        if (child != null) return child
      }
    }
    return null
  }

  private fun requestBluetoothPermissions() {
    val neededPermissions = mutableListOf<String>()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
        neededPermissions.add(Manifest.permission.BLUETOOTH_SCAN)
      }
      if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
        neededPermissions.add(Manifest.permission.BLUETOOTH_CONNECT)
      }
    }

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
      neededPermissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    if (neededPermissions.isNotEmpty()) {
      ActivityCompat.requestPermissions(this, neededPermissions.toTypedArray(), 1001)
    }
  }
}
