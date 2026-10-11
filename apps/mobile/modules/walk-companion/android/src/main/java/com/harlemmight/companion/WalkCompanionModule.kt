package com.harlemmight.companion

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.facebook.react.common.LifecycleState
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.CapabilityInfo
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.time.Instant

/** No DataItems/outbox: personal data and commands exist only in foreground memory. */
class WalkCompanionModule : Module(), MessageClient.OnMessageReceivedListener, CapabilityClient.OnCapabilityChangedListener {
    private val main = Handler(Looper.getMainLooper())
    private var snapshotJSON: String? = null
    private var targetNode: String? = null
    private var generation = 0
    private var observing = false
    private var foreground = false
    private var handoffId = ""
    private var authorizedHandoff: String? = null
    private var expiry: Runnable? = null
    private var listenerContext: Context? = null
    private val commands = mutableSetOf<String>()
    private val context get() = appContext.reactContext
    private fun active() = observing && foreground

    override fun definition() = ModuleDefinition {
        Name("WalkCompanion")
        Events("onCommand")
        OnStartObserving { main.post {
            observing = true
            foreground = context?.lifecycleState == LifecycleState.RESUMED
            context?.let {
                listenerContext = it.applicationContext
                Wearable.getMessageClient(it).addListener(this@WalkCompanionModule)
                Wearable.getCapabilityClient(it).addListener(this@WalkCompanionModule, CompanionWire.WATCH)
            }
        } }
        OnStopObserving { main.post { observing = false; foreground = false; clearState(); removeListeners() } }
        OnActivityEntersForeground { main.post { foreground = true } }
        OnActivityEntersBackground { main.post { foreground = false; clearState() } }
        OnDestroy { main.post { observing = false; foreground = false; clearState(); removeListeners() } }
        AsyncFunction("createHandoffId") {
            clearState()
            UUID.randomUUID().toString().also { authorizedHandoff = it }
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("getStatus") { promise: Promise ->
            val ctx = context
            if (ctx == null) promise.resolve(mapOf("available" to false, "reachable" to false))
            else Wearable.getCapabilityClient(ctx).getCapability(CompanionWire.WATCH, CapabilityClient.FILTER_REACHABLE)
                .addOnSuccessListener { result -> promise.resolve(mapOf("available" to true, "reachable" to (result.nodes.size == 1))) }
                .addOnFailureListener { promise.resolve(mapOf("available" to false, "reachable" to false)) }
        }.runOnQueue(Queues.MAIN)
        AsyncFunction("clear") { clearState() }.runOnQueue(Queues.MAIN)
        AsyncFunction("publish") { json: String, promise: Promise ->
            val ctx = context
            val next = CompanionWire.snapshot(json)
            if (ctx == null || next == null || next.optString("handoffId") != authorizedHandoff || !active()) {
                clearState()
                promise.reject("HANDOFF_UNAVAILABLE", "Open both phone and watch apps before sharing.", null)
            } else {
                val operation = ++generation
                Wearable.getCapabilityClient(ctx).getCapability(CompanionWire.WATCH, CapabilityClient.FILTER_REACHABLE)
                    .addOnSuccessListener { result ->
                        val node = result.nodes.singleOrNull()
                        val previous = snapshotJSON?.let { CompanionWire.snapshot(it) }
                        if (operation != generation || !active() || node == null ||
                            (previous != null && previous.getString("handoffId") == next.getString("handoffId") &&
                                (previous.getString("sessionId") != next.getString("sessionId") || previous.getLong("revision") > next.getLong("revision") ||
                                    (previous.getLong("revision") == next.getLong("revision") && Instant.parse(previous.getString("updatedAt")) > Instant.parse(next.getString("updatedAt")))))) {
                            if (operation == generation) clearState()
                            promise.reject("HANDOFF_UNAVAILABLE", "Reconnect one watch and share a fresh walk.", null)
                        } else {
                            if (previous?.optString("handoffId") != next.getString("handoffId")) commands.clear()
                            targetNode = node.id; snapshotJSON = json
                            handoffId = next.getString("handoffId")
                            expiry?.let { main.removeCallbacks(it) }
                            expiry = Runnable { if (operation == generation) clearState() }.also {
                                main.postDelayed(it, (Instant.parse(next.getString("expiresAt")).toEpochMilli() - System.currentTimeMillis()).coerceAtLeast(1))
                            }
                            Wearable.getMessageClient(ctx).sendMessage(node.id, CompanionWire.SNAPSHOT, json.toByteArray(Charsets.UTF_8))
                                .addOnSuccessListener { promise.resolve(null) }
                                .addOnFailureListener { if (operation == generation) clearState(); promise.reject("HANDOFF_UNAVAILABLE", "Watch disconnected.", it) }
                        }
                    }.addOnFailureListener {
                        if (operation == generation) clearState()
                        promise.reject("HANDOFF_UNAVAILABLE", "Wear Data Layer is unavailable.", it)
                    }
            }
        }.runOnQueue(Queues.MAIN)
    }
    private fun removeListeners() { listenerContext?.let {
        Wearable.getMessageClient(it).removeListener(this)
        Wearable.getCapabilityClient(it).removeListener(this, CompanionWire.WATCH)
    }; listenerContext = null }
    private fun clearState() {
        generation++
        val oldNode = targetNode
        val oldHandoff = handoffId
        handoffId = ""
        authorizedHandoff = null
        expiry?.let { main.removeCallbacks(it) }
        snapshotJSON = null; targetNode = null; commands.clear()
        if (oldNode != null) send(oldNode, CompanionWire.CLEAR, oldHandoff)
    }
    private fun send(node: String, path: String, value: String) {
        context?.let { Wearable.getMessageClient(it).sendMessage(node, path, value.toByteArray(Charsets.UTF_8)) }
    }
    override fun onCapabilityChanged(info: CapabilityInfo) { main.post {
        if (targetNode != null && info.nodes.none { it.id == targetNode }) clearState()
    } }
    override fun onMessageReceived(event: MessageEvent) { main.post {
        if (event.data.size > 8192) return@post
        // Revocation is valid even after the snapshot expires or the phone pauses.
        if (event.path == CompanionWire.CLEAR) {
            if (event.sourceNodeId == targetNode && handoffId.isNotEmpty() &&
                event.data.toString(Charsets.UTF_8) == handoffId) clearState()
            return@post
        }
        val current = snapshotJSON?.let { CompanionWire.snapshot(it) }
        if (event.sourceNodeId != targetNode || !active() || current == null) {
            if (event.path == CompanionWire.REQUEST) {
                if (event.sourceNodeId == targetNode && handoffId.isNotEmpty() &&
                    event.data.toString(Charsets.UTF_8) == handoffId) clearState()
                send(event.sourceNodeId, CompanionWire.CLEAR, event.data.toString(Charsets.UTF_8))
            }
            return@post
        }
        if (event.path == CompanionWire.REQUEST) { send(event.sourceNodeId, CompanionWire.SNAPSHOT, snapshotJSON!!); return@post }
        if (event.path != CompanionWire.COMMAND) return@post
        val json = event.data.toString(Charsets.UTF_8)
        val command = CompanionWire.command(json, current)
        if (command == null || commands.size >= 128 || !commands.add(command.getString("commandId"))) {
            send(event.sourceNodeId, CompanionWire.SNAPSHOT, snapshotJSON!!); return@post
        }
        sendEvent("onCommand", mapOf("json" to json, "expiresAt" to current.getString("expiresAt")))
        // Only a later authoritative snapshot confirms a state change.
    } }
}
