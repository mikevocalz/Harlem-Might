package expo.modules.kotlin

class Promise {
    var settled = false; private set
    var value: Any? = null; private set
    var rejection: String? = null; private set
    fun resolve(value: Any?) { check(!settled); settled = true; this.value = value }
    fun reject(code: String, message: String, cause: Throwable?) { check(!settled); settled = true; rejection = "$code: $message" }
}
