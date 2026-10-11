package com.harlemmight.companion

import org.json.JSONObject
import java.time.Instant

/** The same parser is compiled by both the phone module and Wear app. */
object CompanionWire {
    const val SNAPSHOT = "/harlem/walk/v1/snapshot"
    const val COMMAND = "/harlem/walk/v1/command"
    const val REQUEST = "/harlem/walk/v1/request"
    const val CLEAR = "/harlem/walk/v1/clear"
    const val PHONE = "harlem_walk_phone_v1"
    const val WATCH = "harlem_walk_watch_v1"
    private val snapshotKeys = setOf("schemaVersion", "handoffId", "sessionId", "revision", "status", "walkTitle", "nextStopId", "nextStopTitle", "completedCount", "totalStops", "updatedAt", "expiresAt", "routeState", "instruction", "hapticsEnabled")
    private val commandKeys = setOf("schemaVersion", "commandId", "sessionId", "handoffId", "expectedRevision", "type", "confirmed", "stopId")
    private fun text(o: JSONObject, key: String, max: Int = 160) =
        o.opt(key) is String && o.getString(key).isNotEmpty() && o.getString(key).length <= max
    private fun integer(o: JSONObject, key: String): Boolean {
        val v = o.opt(key)
        return (v is Int || v is Long) && (v as Number).toLong() in 0..9_007_199_254_740_991L
    }
    private fun parse(json: String, keys: Set<String>): JSONObject? = try {
        if (json.toByteArray(Charsets.UTF_8).size > 8192) null else JSONObject(json).takeIf { o -> o.keys().asSequence().all { it in keys } }
    } catch (_: Exception) { null }
    fun fresh(s: JSONObject, now: Long = System.currentTimeMillis()): Boolean = try {
        val updated = Instant.parse(s.getString("updatedAt")).toEpochMilli()
        val expires = Instant.parse(s.getString("expiresAt")).toEpochMilli()
        updated <= now + 30_000 && expires > now && expires > updated && expires - updated <= 300_000 && now - updated <= 300_000
    } catch (_: Exception) { false }
    fun snapshot(json: String): JSONObject? {
        val s = parse(json, snapshotKeys) ?: return null
        if (!integer(s, "schemaVersion") || s.getInt("schemaVersion") != 1 ||
            !text(s, "handoffId") || !text(s, "sessionId") || !text(s, "walkTitle") || !integer(s, "revision") ||
            s.optString("status") !in listOf("active", "paused", "completed", "stopped") ||
            s.optString("routeState") !in listOf("ready", "offline", "unavailable") ||
            !integer(s, "completedCount") || !integer(s, "totalStops") || s.getLong("totalStops") !in 1..100 ||
            s.getLong("completedCount") > s.getLong("totalStops") || s.opt("hapticsEnabled") !is Boolean ||
            !s.has("nextStopId") || !s.has("nextStopTitle") || !s.has("instruction") ||
            s.isNull("nextStopId") != s.isNull("nextStopTitle") ||
            (!s.isNull("nextStopId") && !text(s, "nextStopId")) ||
            (!s.isNull("nextStopTitle") && !text(s, "nextStopTitle")) ||
            (!s.isNull("instruction") && !text(s, "instruction", 500)) || !fresh(s)) return null
        val minimumRevision = s.getLong("completedCount") + (if (s.getString("status") in listOf("paused", "stopped")) 1 else 0)
        if (s.getLong("revision") < minimumRevision) return null
        return s
    }
    fun command(json: String, s: JSONObject): JSONObject? {
        val c = parse(json, commandKeys) ?: return null
        val type = c.optString("type")
        if (!integer(c, "schemaVersion") || c.getInt("schemaVersion") != 1 || !text(c, "commandId") ||
            c.opt("handoffId") != s.opt("handoffId") || c.opt("sessionId") != s.opt("sessionId") ||
            !integer(c, "expectedRevision") || c.getLong("expectedRevision") != s.getLong("revision") || !fresh(s) ||
            type !in listOf("pause", "resume", "stop", "confirm-stop") ||
            (c.has("confirmed") && c.opt("confirmed") != true) ||
            (type in listOf("stop", "confirm-stop") && c.opt("confirmed") != true) ||
            (if (type == "confirm-stop") !text(c, "stopId") || c.opt("stopId") != s.opt("nextStopId") else c.has("stopId"))) return null
        return c
    }
}
