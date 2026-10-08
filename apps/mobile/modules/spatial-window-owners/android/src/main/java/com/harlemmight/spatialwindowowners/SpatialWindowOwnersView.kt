package com.harlemmight.spatialwindowowners

import android.content.Context
import android.util.Log
import androidx.activity.ComponentActivity
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * A layout-transparent container that gives its window the host activity's
 * view-tree owners.
 *
 * Meta's VR Layout SDK moves promoted `SpatialWindow` content into a new
 * Android window rooted at `SpatialWindowRootViewGroup`. That root is not under
 * the activity's decor view, so it has no `ViewTreeLifecycleOwner`, and any
 * Compose view inside it throws on attach.
 *
 * `ViewGroup.dispatchAttachedToWindow` runs this view's `onAttachedToWindow`
 * before it dispatches to the children, so the owners are on the window root
 * before a Compose descendant asks for them. Owners already present (the
 * activity's own decor view, or anything another component installed) are
 * never replaced.
 */
class SpatialWindowOwnersView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    val activity = appContext.currentActivity
    if (activity !is ComponentActivity) {
      Log.w(
        TAG,
        "Host activity is ${activity?.javaClass?.name ?: "null"}, not a ComponentActivity; " +
          "Compose content in this window has no view-tree owners.",
      )
      return
    }
    rootView.installMissingViewTreeOwners(activity)
  }

  private companion object {
    const val TAG = "SpatialWindowOwners"
  }
}
