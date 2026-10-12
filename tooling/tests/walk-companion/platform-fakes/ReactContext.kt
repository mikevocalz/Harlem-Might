package com.facebook.react.bridge

import android.content.Context
import com.facebook.react.common.LifecycleState

class ReactContext(var lifecycleState: LifecycleState = LifecycleState.RESUMED) : Context()
