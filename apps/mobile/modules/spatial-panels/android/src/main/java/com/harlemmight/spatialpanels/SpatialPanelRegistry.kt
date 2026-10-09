package com.harlemmight.spatialpanels

import android.os.Looper
import androidx.annotation.MainThread
import java.lang.ref.WeakReference

/**
 * The open panel activities, by the component name each one renders, and the
 * one listener that reports their lifecycle to JS.
 *
 * Owned by the main thread: activity callbacks run there, and the module
 * calls in from `Queues.MAIN`. Every entry point checks the thread instead of
 * locking.
 */
internal object SpatialPanelRegistry {
  interface Listener {
    fun onPanelOpened(name: String)

    fun onPanelClosed(name: String, reason: PanelCloseReason)
  }

  private val panels = mutableMapOf<String, WeakReference<SpatialPanelActivity>>()
  private var listener: Listener? = null

  @MainThread
  fun setListener(value: Listener?) {
    checkMainThread()
    listener = value
  }

  @MainThread
  fun find(name: String): SpatialPanelActivity? {
    checkMainThread()
    val activity = panels[name]?.get()
    if (activity == null || activity.isFinishing || activity.isDestroyed) return null
    return activity
  }

  @MainThread
  fun opened(name: String, activity: SpatialPanelActivity) {
    checkMainThread()
    panels[name] = WeakReference(activity)
    listener?.onPanelOpened(name)
  }

  @MainThread
  fun closed(name: String, activity: SpatialPanelActivity, reason: PanelCloseReason) {
    checkMainThread()
    // A newer instance may already own the name; only its own entry is removed.
    if (panels[name]?.get() === activity) panels.remove(name)
    listener?.onPanelClosed(name, reason)
  }

  private fun checkMainThread() {
    check(Looper.myLooper() == Looper.getMainLooper()) {
      "SpatialPanelRegistry is main-thread only; called from ${Thread.currentThread().name}."
    }
  }
}
