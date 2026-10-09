package com.harlemmight.spatialpanels

import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Opens and closes React Native components as separate Horizon OS panels
 * ([SpatialPanelActivity]). JS: `modules/spatial-panels`.
 */
class SpatialPanelsModule : Module() {
  private val listener =
    object : SpatialPanelRegistry.Listener {
      override fun onPanelOpened(name: String) {
        sendEvent(EVENT_OPENED, mapOf("name" to name))
      }

      override fun onPanelClosed(name: String, reason: PanelCloseReason) {
        sendEvent(EVENT_CLOSED, mapOf("name" to name, "reason" to reason.value))
      }
    }

  // The activity is declared in the quest flavor's manifest only, so this is
  // false on mobile and PICO builds. Resolved once: the manifest cannot change
  // while the app runs.
  private val isAvailable: Boolean by lazy {
    val context = appContext.reactContext ?: return@lazy false
    try {
      context.packageManager.getActivityInfo(ComponentName(context, SpatialPanelActivity::class.java), 0)
      return@lazy true
    } catch (_: PackageManager.NameNotFoundException) {
      return@lazy false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("SpatialPanels")

    Events(EVENT_OPENED, EVENT_CLOSED)

    Property("isAvailable") { isAvailable }

    AsyncFunction("openPanel") { name: String, props: Map<String, String> ->
      if (!isAvailable) {
        throw PanelUnavailableException()
      }
      SpatialPanelRegistry.setListener(listener)
      if (SpatialPanelRegistry.find(name) != null) return@AsyncFunction
      val activity = appContext.currentActivity ?: throw NoLaunchingActivityException(name)
      val bundle = Bundle()
      for ((key, value) in props) bundle.putString(key, value)
      activity.startActivity(SpatialPanelActivity.intent(activity, name, bundle))
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("closePanel") { name: String ->
      SpatialPanelRegistry.find(name)?.closeFromApp()
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      Handler(Looper.getMainLooper()).post { SpatialPanelRegistry.setListener(null) }
    }
  }

  private companion object {
    const val EVENT_OPENED = "onPanelOpened"
    const val EVENT_CLOSED = "onPanelClosed"
  }
}
