package android.os

/** Deterministic host boundary only: no companion state or protocol decisions. */
class Looper { companion object { fun getMainLooper() = Looper() } }
class Handler(@Suppress("UNUSED_PARAMETER") looper: Looper) {
    fun post(runnable: Runnable): Boolean = postDelayed(runnable, 0)
    fun postDelayed(runnable: Runnable, delay: Long): Boolean {
        scheduled.add(Entry(now + delay, sequence++, runnable)); return true
    }
    fun removeCallbacks(runnable: Runnable) { scheduled.removeAll { it.runnable === runnable } }
    companion object {
        private data class Entry(val at: Long, val sequence: Long, val runnable: Runnable)
        private val scheduled = mutableListOf<Entry>()
        var now = 0L; private set
        private var sequence = 0L
        val pendingCount get() = scheduled.size
        fun reset(at: Long) { scheduled.clear(); now = at; sequence = 0 }
        /** Advance wall time independently of delivery to simulate a busy main loop. */
        fun elapse(milliseconds: Long) { require(milliseconds >= 0); now += milliseconds }
        fun drain() {
            var iterations = 0
            while (true) {
                val next = scheduled.filter { it.at <= now }.minWithOrNull(compareBy<Entry> { it.at }.thenBy { it.sequence }) ?: return
                check(++iterations < 10_000) { "Unbounded callback loop" }
                scheduled.remove(next); next.runnable.run()
            }
        }
    }
}
