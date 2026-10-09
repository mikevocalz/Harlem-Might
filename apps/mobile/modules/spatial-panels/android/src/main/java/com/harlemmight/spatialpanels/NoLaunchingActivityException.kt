package com.harlemmight.spatialpanels

import expo.modules.kotlin.exception.CodedException

/** `openPanel` ran while the app had no activity to launch the panel from. */
internal class NoLaunchingActivityException(name: String) :
  CodedException("Cannot open panel $name: there is no current activity to launch it from.")
