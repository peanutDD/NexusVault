package com.uploaddownloadutil.mobile

import android.animation.ValueAnimator
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  private val statusBarHandler = Handler(Looper.getMainLooper())
  private var rootWebView: WebView? = null
  private var statusBarAnimator: ValueAnimator? = null
  private var currentStatusBarColor: Int = Color.TRANSPARENT
  private var lastIsLightBackground: Boolean? = null
  private val lightStatusBarColor: Int = Color.argb(34, 246, 242, 233)
  private val darkStatusBarColor: Int = Color.argb(72, 9, 12, 20)
  private val statusBarSyncTask = object : Runnable {
    override fun run() {
      syncStatusBarStyle()
      statusBarHandler.postDelayed(this, 1200)
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    applyStatusBarStyle(false, false)
    lastIsLightBackground = false
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    rootWebView = webView
    syncStatusBarStyle()
    statusBarHandler.post(statusBarSyncTask)
  }

  override fun onDestroy() {
    statusBarHandler.removeCallbacks(statusBarSyncTask)
    statusBarAnimator?.cancel()
    statusBarAnimator = null
    rootWebView = null
    super.onDestroy()
  }

  private fun syncStatusBarStyle() {
    val view = rootWebView ?: return
    view.evaluateJavascript(
      "(function(){var d=document.documentElement;var t=d.getAttribute('data-theme');var dark=d.classList.contains('dark')||t==='dark';return dark?'dark':'light';})();"
    ) { result ->
      val isLightBackground = result.contains("light")
      val shouldAnimate = lastIsLightBackground != null && lastIsLightBackground != isLightBackground
      applyStatusBarStyle(isLightBackground, shouldAnimate)
      lastIsLightBackground = isLightBackground
    }
  }

  private fun applyStatusBarStyle(isLightBackground: Boolean, animated: Boolean) {
    val targetColor = if (isLightBackground) lightStatusBarColor else darkStatusBarColor
    statusBarAnimator?.cancel()
    if (!animated) {
      currentStatusBarColor = targetColor
      window.statusBarColor = targetColor
    } else {
      statusBarAnimator = ValueAnimator.ofArgb(currentStatusBarColor, targetColor).apply {
        duration = 260L
        addUpdateListener { animator ->
          val color = animator.animatedValue as Int
          currentStatusBarColor = color
          window.statusBarColor = color
        }
        start()
      }
    }
    WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = isLightBackground
  }
}
