package androidx.compose.runtime

import kotlin.reflect.KProperty

class MutableState<T>(var value: T)
fun <T> mutableStateOf(value: T) = MutableState(value)
operator fun <T> MutableState<T>.getValue(owner: Any?, property: KProperty<*>) = value
operator fun <T> MutableState<T>.setValue(owner: Any?, property: KProperty<*>, next: T) { value = next }
