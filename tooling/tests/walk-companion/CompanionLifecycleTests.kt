package com.harlemmight.lifecycle

import android.content.Context
import android.os.Handler
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.LifecycleState
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import com.harlemmight.companion.CompanionWire
import com.harlemmight.companion.WalkCompanionModule
import com.harlemmight.watch.WearWalkStore
import expo.modules.kotlin.Promise
import org.json.JSONObject
import java.io.File
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset

private val clock = object : Clock() {
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId): Clock = this
    override fun instant(): Instant = Instant.ofEpochMilli(Handler.now)
}
private lateinit var fixture: String
private fun snapshot(handoff: String = "epoch", revision: Int = 1, ttl: Long = 60_000, status: String = "active"): JSONObject =
    JSONObject(fixture).put("handoffId", handoff).put("revision", revision).put("status", status)
        .put("updatedAt", Instant.ofEpochMilli(Handler.now).toString())
        .put("expiresAt", Instant.ofEpochMilli(Handler.now + ttl).toString())
private fun command(s: JSONObject, id: String = "command", type: String = "pause") = JSONObject()
    .put("schemaVersion", 1).put("commandId", id).put("type", type)
    .put("sessionId", s.getString("sessionId")).put("handoffId", s.getString("handoffId"))
    .put("expectedRevision", s.getLong("revision")).toString()
private fun drain() = Handler.drain()
private fun Promise.rejected() = check(settled && rejection != null) { "Expected rejection, got $value / $rejection" }
private fun Promise.resolved() = check(settled && rejection == null) { "Expected resolution, got $value / $rejection" }
private fun MessageClient.count(path: String) = sent.count { it.path == path }

private class Phone(start: Boolean = true, lifecycle: LifecycleState = LifecycleState.RESUMED) {
    val context = ReactContext(lifecycle)
    val module = WalkCompanionModule(clock)
    val definition = module.definition()
    val endpoint = Wearable.endpoint(context)
    val messages get() = endpoint.messages
    val capabilities get() = endpoint.capabilities
    init { module.appContext.reactContext = context; if (start) event("start") }
    fun event(name: String) { definition.lifecycle(name); drain() }
    fun create(): Promise = definition.call("createHandoffId")
    fun share(): String {
        val result = create(); lookup("watch"); result.resolved(); return result.value as String
    }
    fun lookup(vararg nodes: String) { capabilities.lookups.last().task.succeed(CapabilityClient.info(*nodes)); drain() }
    fun publish(s: JSONObject) = definition.call("publish", s.toString())
    fun install(s: JSONObject): MessageClient.Sent {
        val result = publish(s); lookup("watch")
        val send = messages.sent.last { it.path == CompanionWire.SNAPSHOT }
        send.task.succeed(1); drain(); result.resolved(); return send
    }
    fun receive(path: String, value: String, node: String = "watch") { messages.receive(node, path, value); drain() }
}
private class Watch {
    val context = Context()
    val store = WearWalkStore(context, clock)
    val endpoint = Wearable.endpoint(context)
    val messages get() = endpoint.messages
    val capabilities get() = endpoint.capabilities
    init { store.start() }
    fun lookup(vararg nodes: String) { capabilities.lookups.last().task.succeed(CapabilityClient.info(*nodes)); drain() }
    fun connect() { lookup("phone") }
    fun receive(s: JSONObject, node: String = "phone") { messages.receive(node, CompanionWire.SNAPSHOT, s.toString()); drain() }
    fun clear(handoff: String, node: String = "phone") { messages.receive(node, CompanionWire.CLEAR, handoff); drain() }
}

fun main(args: Array<String>) {
    fixture = JSONObject(File(args.single()).readText()).getJSONArray("snapshots").getJSONObject(0).getString("json")
    var count = 0
    val failures = mutableListOf<String>()
    fun test(name: String, body: () -> Unit) {
        Handler.reset(1_800_000_000_000L); Wearable.reset()
        try { body(); println("PASS: $name") } catch (error: Throwable) { failures.add("$name: $error"); error.printStackTrace() }
        count++
    }

    test("Expo retains a public no-argument constructor for autolinking") {
        WalkCompanionModule::class.java.getConstructor().newInstance()
    }
    test("phone requires a resumed activity and an observer before authorizing") {
        for (phone in listOf(Phone(start = false), Phone(lifecycle = LifecycleState.BEFORE_RESUME))) {
            phone.create().rejected(); check(phone.capabilities.lookups.isEmpty())
        }
    }
    for (event in listOf("background", "stop", "destroy")) {
        test("phone $event rejects delayed authorization and removes owned listeners when stopped") {
            val p = Phone(); val request = p.create()
            p.event(event); p.lookup("watch"); request.rejected()
            if (event != "background") {
                check(p.messages.listeners.isEmpty()); check(p.capabilities.listeners.isEmpty())
            }
        }
        test("phone $event cancels expiry and revokes old publishers and commands") {
            val p = Phone(); val s = snapshot(p.share()); p.install(s)
            check(Handler.pendingCount == 1)
            p.event(event)
            check(Handler.pendingCount == 0)
            check(p.messages.sent.last().path == CompanionWire.CLEAR && p.messages.sent.last().text == s.getString("handoffId"))
            p.event("foreground"); p.publish(s).rejected()
            p.receive(CompanionWire.COMMAND, command(s)); check(p.module.emitted.isEmpty())
        }
    }
    test("phone background cancels an in-flight publication lookup") {
        val p = Phone(); val s = snapshot(p.share()); val result = p.publish(s)
        p.event("background"); p.lookup("watch"); result.rejected()
        check(p.messages.count(CompanionWire.SNAPSHOT) == 0); check(Handler.pendingCount == 0)
    }
    test("phone rejects a payload expiring exactly while capability discovery is delayed") {
        val p = Phone(); val s = snapshot(p.share(), ttl = 1_000); val result = p.publish(s)
        Handler.elapse(1_000); p.lookup("watch"); result.rejected()
        check(p.messages.count(CompanionWire.SNAPSHOT) == 0); check(Handler.pendingCount == 0)
    }
    test("phone refresh lookup cannot disarm the installed snapshot expiry") {
        val p = Phone(); val epoch = p.share(); p.install(snapshot(epoch, ttl = 1_000))
        val result = p.publish(snapshot(epoch, revision = 2)); val lookup = p.capabilities.lookups.last().task
        Handler.elapse(1_000); drain()
        lookup.succeed(CapabilityClient.info("watch")); drain(); result.rejected()
        check(p.messages.count(CompanionWire.SNAPSHOT) == 1); check(Handler.pendingCount == 0)
    }
    test("phone publication binds discovery to the authorized peer and rejects ambiguity") {
        for (nodes in listOf(arrayOf("other-watch"), arrayOf("watch", "other-watch"), emptyArray())) {
            val p = Phone(); val result = p.publish(snapshot(p.share())); p.lookup(*nodes); result.rejected()
            check(p.messages.count(CompanionWire.SNAPSHOT) == 0)
        }
    }
    test("phone newer authorization survives older capability success and failure") {
        for (succeeds in listOf(true, false)) {
            val p = Phone(); val old = p.create(); val task = p.capabilities.lookups.last().task
            val fresh = p.share()
            if (succeeds) task.succeed(CapabilityClient.info("watch")) else task.fail()
            drain(); old.rejected(); p.install(snapshot(fresh))
        }
    }
    test("phone old send failure cannot erase a newly shared handoff") {
        val p = Phone(); val old = p.publish(snapshot(p.share())); p.lookup("watch")
        val task = p.messages.sent.last().task
        val fresh = snapshot(p.share()); p.install(fresh)
        task.fail(); drain(); old.rejected()
        p.receive(CompanionWire.REQUEST, fresh.getString("handoffId"))
        check(p.messages.sent.last().text == fresh.toString())
    }
    test("phone ignores wrong-peer commands and revocations, then deduplicates valid commands") {
        val p = Phone(); val s = snapshot(p.share()); p.install(s)
        p.receive(CompanionWire.CLEAR, s.getString("handoffId"), "other-watch")
        p.receive(CompanionWire.CLEAR, "old-epoch")
        p.receive(CompanionWire.COMMAND, command(s), "other-watch")
        check(p.module.emitted.isEmpty())
        p.receive(CompanionWire.COMMAND, command(s)); p.receive(CompanionWire.COMMAND, command(s))
        check(p.module.emitted.size == 1)
        check(p.module.emitted.single().second["expiresAt"] == s.getString("expiresAt"))
        p.receive(CompanionWire.REQUEST, "old-epoch", "other-watch")
        check(p.messages.sent.last().path == CompanionWire.CLEAR && p.messages.sent.last().node == "other-watch")
        p.receive(CompanionWire.REQUEST, s.getString("handoffId"))
        check(p.messages.sent.last().path == CompanionWire.SNAPSHOT)
    }
    test("phone command replay cap fails closed and a new handoff resets it") {
        val p = Phone(); val s = snapshot(p.share()); p.install(s)
        repeat(129) { p.receive(CompanionWire.COMMAND, command(s, "command-$it")) }
        check(p.module.emitted.size == 128)
        val fresh = snapshot(p.share()); p.install(fresh); p.receive(CompanionWire.COMMAND, command(fresh, "command-0"))
        check(p.module.emitted.size == 129)
    }
    test("phone matching remote clear revokes refresh lookup and cannot be undone") {
        val p = Phone(); val s = snapshot(p.share()); p.install(s)
        val refresh = p.publish(snapshot(s.getString("handoffId"), revision = 2))
        p.receive(CompanionWire.CLEAR, s.getString("handoffId")); p.lookup("watch"); refresh.rejected()
        p.publish(s).rejected(); check(Handler.pendingCount == 0)
    }
    test("phone capability loss revokes un-published authorization") {
        val p = Phone(); val epoch = p.share(); p.capabilities.changed(); drain()
        p.publish(snapshot(epoch)).rejected()
    }
    test("watch stop cancels timers and listeners and ignores delayed reconnect") {
        val w = Watch(); val lookup = w.capabilities.lookups.last().task
        w.store.stop(); lookup.succeed(CapabilityClient.info("phone")); drain()
        check(w.messages.sent.isEmpty()); check(!w.store.reachable)
        check(w.messages.listeners.isEmpty()); check(w.capabilities.listeners.isEmpty()); check(Handler.pendingCount == 0)
    }
    test("watch stop revokes a displayed handoff and its pending command") {
        val w = Watch(); w.connect(); val s = snapshot(); w.receive(s)
        w.store.send("pause", s); val pending = w.messages.sent.last().task
        check(Handler.pendingCount == 2); w.store.stop()
        check(w.store.snapshot == null && !w.store.pending); check(Handler.pendingCount == 0)
        check(w.messages.sent.last().path == CompanionWire.CLEAR)
        pending.fail(); drain(); check(w.store.snapshot == null)
        w.store.start(); w.connect(); w.receive(s); check(w.store.snapshot == null)
    }
    test("watch rejects wrong-peer snapshots and clear without changing installed guidance") {
        val w = Watch(); w.connect(); val s = snapshot(); w.receive(s, "other-phone")
        check(w.store.snapshot == null); w.receive(s)
        w.clear("epoch", "other-phone"); check(w.store.snapshot?.getString("handoffId") == "epoch")
    }
    test("watch tombstones a clear that overtakes its first snapshot and accepts fresh opt-in") {
        val w = Watch(); w.connect(); w.clear("old-epoch"); w.receive(snapshot("old-epoch"))
        check(w.store.snapshot == null); check(w.messages.sent.last().path == CompanionWire.CLEAR)
        w.receive(snapshot("fresh-epoch")); check(w.store.snapshot?.getString("handoffId") == "fresh-epoch")
    }
    test("watch stale clear does not cancel a pending reconnect to fresh guidance") {
        val w = Watch(); w.connect(); w.store.reconnect(); w.clear("old-epoch")
        w.lookup("phone"); w.receive(snapshot("fresh-epoch"))
        check(w.store.snapshot?.getString("handoffId") == "fresh-epoch")
    }
    test("watch first snapshot supersedes an older reconnect send failure") {
        val w = Watch(); w.connect(); val old = w.messages.sent.last().task
        w.receive(snapshot()); old.fail(); drain(); check(w.store.snapshot != null)
    }
    test("watch same-handoff refresh supersedes reconnect failure without cancelling command timeout") {
        val w = Watch(); w.connect(); val s = snapshot(); w.receive(s)
        w.store.send("pause", s); w.store.reconnect(); w.lookup("phone"); val old = w.messages.sent.last().task
        w.receive(snapshot()); old.fail(); drain()
        check(w.store.snapshot != null && w.store.pending)
        Handler.elapse(10_000); drain()
        check(w.store.snapshot != null && !w.store.pending); check(w.store.status.contains("No confirmation"))
    }
    test("watch newer reconnect supersedes older capability failure") {
        val w = Watch(); val old = w.capabilities.lookups.last().task
        w.store.reconnect(); w.connect(); old.fail(); drain()
        check(w.store.reachable); check(w.messages.count(CompanionWire.REQUEST) == 1)
    }
    test("watch command receipt is not confirmation; a newer authoritative revision cancels timeout") {
        val w = Watch(); w.connect(); val s = snapshot().put("hapticsEnabled", true); w.receive(s)
        w.store.send("pause", s); val send = w.messages.sent.last().task; send.succeed(1); drain()
        check(w.store.pending && w.store.confirmationFeedback == 0)
        w.receive(snapshot(revision = 2, status = "paused").put("hapticsEnabled", true))
        check(!w.store.pending && w.store.confirmationFeedback == 1); check(Handler.pendingCount == 1)
        Handler.elapse(10_000); drain(); check(w.store.status == "Confirmed on your phone.")
    }
    test("watch expired snapshot clears and cancels command timeout without haptic confirmation") {
        val w = Watch(); w.connect(); val s = snapshot(ttl = 1_000); w.receive(s); w.store.send("pause", s)
        Handler.elapse(1_000); drain()
        check(w.store.snapshot == null && !w.store.pending); check(Handler.pendingCount == 0)
        check(w.store.confirmationFeedback == 0); check(w.messages.sent.last().path == CompanionWire.CLEAR)
    }
    test("watch rejects stale confirmation dialog state and regressing snapshots") {
        val w = Watch(); w.connect(); val old = snapshot(); w.receive(old)
        val fresh = snapshot(revision = 2); w.receive(fresh)
        w.store.send("confirm-stop", old); check(w.messages.count(CompanionWire.COMMAND) == 0)
        w.receive(old); check(w.store.snapshot?.getInt("revision") == 2)
    }
    test("watch new handoff cancels old command and rejects late errors and old snapshots") {
        val w = Watch(); w.connect(); val old = snapshot(); w.receive(old); w.store.send("pause", old)
        val failure = w.messages.sent.last().task
        w.receive(snapshot("new-epoch")); check(!w.store.pending); check(Handler.pendingCount == 1)
        failure.fail(); drain(); w.receive(old)
        check(w.store.snapshot?.getString("handoffId") == "new-epoch")
    }
    test("watch ambiguous capability membership fails closed even if old phone remains") {
        val w = Watch(); w.connect(); w.receive(snapshot()); w.capabilities.changed("phone", "other-phone"); drain()
        check(w.store.snapshot == null && !w.store.reachable)
    }
    test("watch reconnect cannot carry one phone's guidance over to another peer") {
        val w = Watch(); w.connect(); val s = snapshot(); w.receive(s)
        w.store.reconnect(); w.lookup("other-phone")
        check(w.store.snapshot == null)
        w.store.send("pause", s); check(w.messages.count(CompanionWire.COMMAND) == 0)
    }

    test("watch refresh replaces its old timer and expires exactly on the new boundary") {
        val w = Watch(); w.connect(); w.receive(snapshot(ttl = 1_000))
        Handler.elapse(500); w.receive(snapshot(revision = 2, ttl = 2_000))
        check(Handler.pendingCount == 1)
        Handler.elapse(500); drain(); check(w.store.snapshot?.getInt("revision") == 2)
        Handler.elapse(1_499); drain(); check(w.store.snapshot != null)
        Handler.elapse(1); drain(); check(w.store.snapshot == null && Handler.pendingCount == 0)
    }
    test("watch stop wins over a snapshot already queued on the main handler") {
        val w = Watch(); w.connect()
        w.messages.receive("phone", CompanionWire.SNAPSHOT, snapshot().toString())
        w.store.stop(); drain()
        check(w.store.snapshot == null && !w.store.reachable); check(Handler.pendingCount == 0)
    }
    test("watch replacement-peer request failures still revoke reachability") {
        val w = Watch(); w.connect(); w.receive(snapshot())
        w.store.reconnect(); w.lookup("other-phone")
        val request = w.messages.sent.last()
        check(request.node == "other-phone" && request.path == CompanionWire.REQUEST && request.text.isEmpty())
        check(w.messages.sent.any { it.node == "phone" && it.path == CompanionWire.CLEAR && it.text == "epoch" })
        request.task.fail(); drain()
        check(w.store.snapshot == null && !w.store.reachable)
    }
    test("actual phone and watch callbacks complete confirmation then propagate background revocation") {
        val p = Phone(); val w = Watch(); w.connect()
        val s = snapshot(p.share()).put("hapticsEnabled", true)
        val initial = p.install(s)
        w.messages.receive("phone", initial.path, initial.text); drain()
        check(w.store.snapshot?.getString("handoffId") == s.getString("handoffId"))
        w.store.send("pause", checkNotNull(w.store.snapshot))
        val action = w.messages.sent.last()
        p.messages.receive("watch", action.path, action.text); drain()
        check(p.module.emitted.size == 1 && w.store.pending)
        val emitted = p.module.emitted.single().second
        check(JSONObject(emitted["json"] as String).getString("type") == "pause")
        val confirmed = snapshot(s.getString("handoffId"), revision = 2, status = "paused").put("hapticsEnabled", true)
        val update = p.install(confirmed)
        w.messages.receive("phone", update.path, update.text); drain()
        check(!w.store.pending && w.store.confirmationFeedback == 1)
        p.event("background")
        val revoke = p.messages.sent.last()
        check(revoke.path == CompanionWire.CLEAR)
        w.messages.receive("phone", revoke.path, revoke.text); drain()
        check(w.store.snapshot == null && !w.store.pending); check(Handler.pendingCount == 0)
        w.messages.receive("phone", update.path, update.text); drain()
        check(w.store.snapshot == null)
    }

    failures.forEach(System.err::println)
    check(failures.isEmpty()) { "${failures.size} / $count production Kotlin lifecycle cases failed" }
    println("PASS: $count production Kotlin lifecycle/callback cases")
}
