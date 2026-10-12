@file:Suppress("UNUSED_PARAMETER", "FunctionName")
package expo.modules.kotlin.modules

import android.content.Context
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues

class AppContext { var reactContext: Context? = null }
open class Module {
    val appContext = AppContext()
    val emitted = mutableListOf<Pair<String, Map<String, Any?>>>()
    open fun definition() = ModuleDefinition {}
    fun sendEvent(name: String, value: Map<String, Any?>) { emitted.add(name to value) }
}

/** Captures production DSL callbacks; it does not reproduce their bodies. */
class ModuleDefinition(body: ModuleDefinition.() -> Unit) {
    private val lifecycle = mutableMapOf<String, () -> Unit>()
    private val functions = mutableMapOf<String, (String?, Promise) -> Unit>()
    init { body() }
    fun Name(name: String) {}
    fun Events(vararg names: String) {}
    fun OnStartObserving(body: () -> Unit) { lifecycle["start"] = body }
    fun OnStopObserving(body: () -> Unit) { lifecycle["stop"] = body }
    fun OnActivityEntersForeground(body: () -> Unit) { lifecycle["foreground"] = body }
    fun OnActivityEntersBackground(body: () -> Unit) { lifecycle["background"] = body }
    fun OnDestroy(body: () -> Unit) { lifecycle["destroy"] = body }
    fun AsyncFunction(name: String, body: () -> Unit): Function {
        functions[name] = { _, promise -> body(); promise.resolve(null) }; return Function()
    }
    @Suppress("UNCHECKED_CAST")
    fun <P> AsyncFunction(name: String, body: (P) -> Unit): Function {
        functions[name] = { _, promise -> body(promise as P) }; return Function()
    }
    fun AsyncFunction(name: String, body: (String, Promise) -> Unit): Function {
        functions[name] = { value, promise -> body(checkNotNull(value), promise) }; return Function()
    }
    fun lifecycle(name: String) { lifecycle.getValue(name)() }
    fun call(name: String, value: String? = null): Promise = Promise().also { functions.getValue(name)(value, it) }
    class Function { fun runOnQueue(queue: Queues) {} }
}
