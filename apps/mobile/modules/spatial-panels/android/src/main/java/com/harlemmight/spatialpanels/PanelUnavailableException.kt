package com.harlemmight.spatialpanels

import expo.modules.kotlin.exception.CodedException

/** `openPanel` ran on a build without [SpatialPanelActivity] in its manifest. */
internal class PanelUnavailableException :
  CodedException(
    "Spatial panels need the quest build: SpatialPanelActivity is not declared in this APK's manifest. " +
      "Render the content in the main window instead.",
  )
