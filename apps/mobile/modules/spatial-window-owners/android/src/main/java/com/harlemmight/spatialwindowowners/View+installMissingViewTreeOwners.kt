package com.harlemmight.spatialwindowowners

import android.view.View
import androidx.activity.ComponentActivity
import androidx.activity.findViewTreeOnBackPressedDispatcherOwner
import androidx.activity.setViewTreeOnBackPressedDispatcherOwner
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.findViewTreeViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.findViewTreeSavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner

/**
 * Installs [activity] as each view-tree owner this view cannot already find,
 * the same four owners `ComponentActivity.initializeViewTreeOwners` puts on
 * its decor view. An owner found on this view or any ancestor is left alone.
 */
internal fun View.installMissingViewTreeOwners(activity: ComponentActivity) {
  if (findViewTreeLifecycleOwner() == null) {
    setViewTreeLifecycleOwner(activity)
  }
  if (findViewTreeViewModelStoreOwner() == null) {
    setViewTreeViewModelStoreOwner(activity)
  }
  if (findViewTreeSavedStateRegistryOwner() == null) {
    setViewTreeSavedStateRegistryOwner(activity)
  }
  if (findViewTreeOnBackPressedDispatcherOwner() == null) {
    setViewTreeOnBackPressedDispatcherOwner(activity)
  }
}
