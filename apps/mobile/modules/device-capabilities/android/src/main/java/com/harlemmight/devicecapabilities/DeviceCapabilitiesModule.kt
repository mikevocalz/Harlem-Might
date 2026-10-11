package com.harlemmight.devicecapabilities

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import androidx.window.WindowSdkExtensions
import androidx.window.layout.SupportedPosture
import androidx.window.layout.WindowInfoTracker
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Hardware capability is stable even when the cover display has no FoldingFeature. */
class DeviceCapabilitiesModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceCapabilities")
    Function("getDeviceCapabilities") {
      val context = requireNotNull(appContext.reactContext) { "React context is unavailable" }
      val sensors = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
      val hinge = Build.VERSION.SDK_INT >= 30 && sensors?.getDefaultSensor(Sensor.TYPE_HINGE_ANGLE) != null
      val postures = if (WindowSdkExtensions.getInstance().extensionVersion >= 6) {
        WindowInfoTracker.getOrCreate(context).supportedPostures.contains(SupportedPosture.TABLETOP)
      } else false
      return@Function mapOf(
        "isFoldable" to (hinge || postures),
        "isTablet" to (context.resources.configuration.smallestScreenWidthDp >= 600)
      )
    }
  }
}
