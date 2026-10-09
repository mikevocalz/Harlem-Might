package com.harlemmight.spatialpanels

/**
 * Why a panel closed. [App] means JS asked for it through `closePanel`;
 * [User] covers everything else: the panel's close control, Back, or the OS
 * removing the panel.
 */
enum class PanelCloseReason(val value: String) {
  App("app"),
  User("user"),
}
