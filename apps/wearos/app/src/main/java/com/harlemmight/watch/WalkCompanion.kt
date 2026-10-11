package com.harlemmight.watch

import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.CapabilityInfo
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.harlemmight.companion.CompanionWire
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

/** Foreground-only paired state. No preferences, DataItems, services or outbox. */
class WearWalkStore(private val context: Context) : MessageClient.OnMessageReceivedListener, CapabilityClient.OnCapabilityChangedListener {
    var snapshot by mutableStateOf<JSONObject?>(null); private set
    var status by mutableStateOf("Open the phone app and share a walk."); private set
    var pending by mutableStateOf(false); private set
    var reachable by mutableStateOf(false); private set
    var confirmationFeedback by mutableStateOf(0); private set
    private val main = Handler(Looper.getMainLooper())
    private var foreground = false
    private var phone: String? = null
    private var generation = 0
    private var reconnectGeneration = 0
    private var pendingCommand: JSONObject? = null
    private var pendingCount = 0
    private val invalidHandoffs = mutableSetOf<String>()
    private var expiry: Runnable? = null
    private var timeout: Runnable? = null

    fun start() {
        foreground = true
        Wearable.getMessageClient(context).addListener(this)
        Wearable.getCapabilityClient(context).addListener(this, CompanionWire.PHONE)
        reconnect()
    }
    fun stop() {
        foreground = false
        clear("Open both apps and share again to reconnect.")
        Wearable.getMessageClient(context).removeListener(this)
        Wearable.getCapabilityClient(context).removeListener(this, CompanionWire.PHONE)
    }
    private fun notifyPhoneCleared(handoff: String) {
        val node = phone ?: return
        Wearable.getMessageClient(context).sendMessage(node, CompanionWire.CLEAR, handoff.toByteArray(Charsets.UTF_8))
    }
    private fun clear(reason: String, notifyPhone: Boolean = true) {
        generation++
        snapshot?.let {
            invalidHandoffs.add(it.getString("handoffId"))
            if (notifyPhone) notifyPhoneCleared(it.getString("handoffId"))
        }
        snapshot = null; pending = false; pendingCommand = null; reachable = false
        expiry?.let { main.removeCallbacks(it) }; timeout?.let { main.removeCallbacks(it) }
        status = reason
    }
    fun reconnect() {
        if (!foreground) return
        val operation = generation
        val request = ++reconnectGeneration
        Wearable.getCapabilityClient(context).getCapability(CompanionWire.PHONE, CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener { info ->
                if (!foreground || operation != generation || request != reconnectGeneration) return@addOnSuccessListener
                val node = info.nodes.singleOrNull()
                if (node == null) { phone = null; clear("Connect one phone and open Harlem Might."); return@addOnSuccessListener }
                phone = node.id; reachable = true
                Wearable.getMessageClient(context).sendMessage(node.id, CompanionWire.REQUEST, (snapshot?.optString("handoffId") ?: "").toByteArray(Charsets.UTF_8))
                    .addOnFailureListener { if (operation == generation && request == reconnectGeneration) clear("Phone disconnected. Nothing was queued.") }
            }.addOnFailureListener { if (operation == generation && request == reconnectGeneration) clear("Wear Data Layer is unavailable. Public highlights still work.") }
    }
    override fun onCapabilityChanged(info: CapabilityInfo) { main.post {
        if (phone != null && info.nodes.none { it.id == phone }) { phone = null; clear("Phone disconnected. Share again after reconnecting.") }
    } }
    override fun onMessageReceived(event: MessageEvent) { main.post {
        if (!foreground || event.sourceNodeId != phone || event.data.size > 8192) return@post
        if (event.path == CompanionWire.CLEAR) {
            val cleared = event.data.toString(Charsets.UTF_8)
            // Clear can precede the corresponding snapshot on the transport.
            if (cleared.isNotEmpty() && cleared.length <= 160) invalidHandoffs.add(cleared)
            if (cleared == snapshot?.optString("handoffId")) clear("Share your walk again from the phone.", notifyPhone = false)
            return@post
        }
        if (event.path != CompanionWire.SNAPSHOT) return@post
        val next = CompanionWire.snapshot(event.data.toString(Charsets.UTF_8)) ?: return@post
        if (next.getString("handoffId") in invalidHandoffs) {
            notifyPhoneCleared(next.getString("handoffId")); return@post
        }
        val previous = snapshot
        if (previous != null) {
            if (previous.getString("handoffId") == next.getString("handoffId") &&
                (previous.getString("sessionId") != next.getString("sessionId") || next.getLong("revision") < previous.getLong("revision") ||
                    (previous.getLong("revision") == next.getLong("revision") && Instant.parse(previous.getString("updatedAt")) > Instant.parse(next.getString("updatedAt"))))) return@post
        }
        // Any accepted phone snapshot supersedes older reconnect replies/errors,
        // even within one handoff. Keep command timeout/ack generations intact.
        reconnectGeneration++
        if (previous?.optString("handoffId") != next.getString("handoffId")) {
            // First adoption also supersedes any older reconnect callback.
            generation++
            previous?.let { invalidHandoffs.add(it.getString("handoffId")) }
            pending = false; pendingCommand = null; timeout?.let { main.removeCallbacks(it) }
        }
        val c = pendingCommand
        val matches = c != null && c.getString("handoffId") == next.getString("handoffId") &&
            c.getString("sessionId") == next.getString("sessionId") && next.getLong("revision") > c.getLong("expectedRevision")
        val confirmed = matches && when (c?.optString("type")) {
            "confirm-stop" -> next.getInt("completedCount") == pendingCount + 1
            "stop" -> next.getString("status") == "stopped"
            "pause" -> next.getString("status") == "paused"
            "resume" -> next.getString("status") == "active"
            else -> false
        }
        snapshot = next; reachable = true
        if (matches) { pending = false; pendingCommand = null; timeout?.let { main.removeCallbacks(it) } }
        status = if (confirmed) "Confirmed on your phone." else "Paired phone guidance · ${next.getString("routeState")}"
        // UI supplies an optional platform haptic only for this verified user action.
        if (confirmed && next.getBoolean("hapticsEnabled")) confirmationFeedback++
        expiry?.let { main.removeCallbacks(it) }
        expiry = Runnable { clear("Guidance expired. Share a fresh walk from your phone.") }.also {
            main.postDelayed(it, (Instant.parse(next.getString("expiresAt")).toEpochMilli() - System.currentTimeMillis()).coerceAtLeast(1))
        }
    } }
    fun send(type: String, expected: JSONObject) {
        val s = snapshot; val node = phone
        if (!foreground || !reachable || pending || s == null || node == null || !CompanionWire.fresh(s) ||
            expected.opt("handoffId") != s.opt("handoffId") || expected.opt("sessionId") != s.opt("sessionId") ||
            expected.opt("revision") != s.opt("revision") || expected.opt("nextStopId") != s.opt("nextStopId")) {
            status = "Walk changed. Review the latest stop before confirming."; return
        }
        val c = JSONObject().put("schemaVersion", 1).put("commandId", UUID.randomUUID().toString())
            .put("sessionId", s.getString("sessionId")).put("handoffId", s.getString("handoffId"))
            .put("expectedRevision", s.getLong("revision")).put("type", type)
        if (type in listOf("stop", "confirm-stop")) c.put("confirmed", true)
        if (type == "confirm-stop") c.put("stopId", s.opt("nextStopId"))
        val json = c.toString()
        if (CompanionWire.command(json, s) == null) return
        pending = true; pendingCommand = c; pendingCount = s.getInt("completedCount")
        status = "Waiting for your phone to confirm…"
        val operation = ++generation
        timeout?.let { main.removeCallbacks(it) }
        timeout = Runnable {
            if (operation == generation && pendingCommand?.optString("commandId") == c.getString("commandId")) {
                pending = false; pendingCommand = null; status = "No confirmation received. Check the phone before retrying."
            }
        }.also { main.postDelayed(it, 10_000) }
        Wearable.getMessageClient(context).sendMessage(node, CompanionWire.COMMAND, json.toByteArray(Charsets.UTF_8))
            .addOnFailureListener {
                if (operation == generation && pendingCommand?.optString("commandId") == c.getString("commandId")) clear("Phone disconnected. Nothing was queued.")
            }
    }
}
