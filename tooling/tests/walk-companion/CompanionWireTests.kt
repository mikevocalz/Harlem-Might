package com.harlemmight.companion

import org.json.JSONObject
import java.io.File

/** JVM host tests of the production parser, not a Wear/phone lifecycle harness. */
fun main(args: Array<String>) {
    val fixtures = JSONObject(File(args.single()).readText())
    var count = 0
    val failures = mutableListOf<String>()
    for (kind in listOf("snapshots", "commands")) {
        val cases = fixtures.getJSONArray(kind)
        for (i in 0 until cases.length()) {
            val case = cases.getJSONObject(i)
            val name = "$kind: ${case.getString("name")}"
            try {
                val json = case.getString("json")
                val result = if (kind == "snapshots") CompanionWire.snapshot(json)
                    else CompanionWire.command(json, JSONObject(case.getString("snapshotJSON")))
                check((result != null) == case.getBoolean("accepted")) { "expected accepted=${case.getBoolean("accepted")}, got ${result != null}" }
                if (result != null) {
                    // Accepted payloads must retain their identity, revision and fields unchanged.
                    val original = JSONObject(json)
                    check(result.keys().asSequence().toSet() == original.keys().asSequence().toSet())
                    for (key in original.keys().asSequence().map { it as String }) check(result.get(key) == original.get(key)) { "changed $key" }
                }
            } catch (error: Exception) {
                failures.add("$name: $error")
            }
            count++
        }
    }
    // This boundary has a clock parameter, so also test exact millisecond edges.
    val base = JSONObject(fixtures.getJSONArray("snapshots").getJSONObject(0).getString("json"))
    val updated = java.time.Instant.parse(base.getString("updatedAt")).toEpochMilli()
    base.put("expiresAt", java.time.Instant.ofEpochMilli(updated + 300_000).toString())
    check(CompanionWire.fresh(base, updated - 30_000)) { "30s clock skew must be allowed" }
    check(!CompanionWire.fresh(base, updated - 30_001)) { "clock skew over 30s must fail" }
    check(CompanionWire.fresh(base, updated + 299_999)) { "snapshot must be live just before expiry" }
    check(!CompanionWire.fresh(base, updated + 300_000)) { "snapshot must be stale at expiry" }
    failures.forEach(System.err::println)
    check(failures.isEmpty()) { "${failures.size} / $count Kotlin wire cases failed" }
    println("PASS: $count Kotlin wire cases and 4 exact freshness boundaries")
}
