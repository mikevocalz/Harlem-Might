package com.harlemmight.spatialwindowowners

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SpatialWindowOwnersModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SpatialWindowOwners")

    View(SpatialWindowOwnersView::class) {}
  }
}
