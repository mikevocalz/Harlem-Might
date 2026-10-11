package com.harlemmight.watch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalView
import android.view.HapticFeedbackConstants
import androidx.wear.compose.foundation.lazy.TransformingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberTransformingLazyColumnState
import androidx.wear.compose.material3.lazy.rememberTransformationSpec
import androidx.wear.compose.material3.lazy.transformedHeight
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.wear.compose.material3.AlertDialog
import androidx.wear.compose.material3.AlertDialogDefaults
import androidx.wear.compose.material3.ButtonDefaults
import androidx.wear.compose.material3.SurfaceTransformation
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant

/** Public highlights work standalone. Private walk handoff is foreground-only. */
private data class Card(val title: String, val subtitle: String)
private data class Feed(val story: Card?, val event: Card?, val expiresAt: Long)

private fun card(objectValue: JSONObject, name: String): Card? {
    val item = objectValue.optJSONObject(name) ?: return null
    val title = item.optString("title")
    if (title.isBlank()) return null
    return Card(title, item.optString("subtitle"))
}

private suspend fun loadFeed(): Feed? = withContext(Dispatchers.IO) {
    val endpoint = BuildConfig.WIDGET_FEED_URL
    if (!endpoint.startsWith("https://")) return@withContext null
    val connection = (URL(endpoint).openConnection() as HttpURLConnection)
    try {
        connection.connectTimeout = 8000
        connection.readTimeout = 8000
        connection.instanceFollowRedirects = false
        connection.setRequestProperty("Accept", "application/json")
        if (connection.responseCode != 200) return@withContext null
        val payload = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        if (payload.optInt("schemaVersion") != 1) return@withContext null
        val expires = Instant.parse(payload.getString("expiresAt")).toEpochMilli()
        Feed(card(payload, "story"), if (expires > System.currentTimeMillis()) card(payload, "event") else null, expires)
        // Public feed deliberately excludes personal saved places and active walks.
    } catch (_: Exception) { null }
    finally { connection.disconnect() }
}

class MainActivity : ComponentActivity() {
    private lateinit var walkStore: WearWalkStore
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        walkStore = WearWalkStore(applicationContext)
        setContent { HarlemWearApp(walkStore) }
    }
    override fun onResume() { super.onResume(); walkStore.start() }
    override fun onPause() { walkStore.stop(); super.onPause() }
}

private data class WalkConfirmation(val type: String, val snapshot: JSONObject)
private data class WearRow(val label: String, val action: (() -> Unit)? = null, val enabled: Boolean = true)

@Composable
private fun HarlemWearApp(walkStore: WearWalkStore) {
    var feed by remember { mutableStateOf<Feed?>(null) }
    var section by rememberSaveable { mutableStateOf("Now") }
    var confirmation by remember { mutableStateOf<WalkConfirmation?>(null) }
    val view = LocalView.current
    val feedback = walkStore.confirmationFeedback
    var lastFeedback by remember { mutableStateOf(feedback) }
    LaunchedEffect(Unit) { feed = loadFeed() }
    LaunchedEffect(feed?.expiresAt) {
        val current = feed ?: return@LaunchedEffect
        delay((current.expiresAt - System.currentTimeMillis()).coerceAtLeast(0))
        if (feed?.expiresAt == current.expiresAt) feed = current.copy(event = null)
    }
    LaunchedEffect(feedback) {
        if (feedback != lastFeedback && view.hasWindowFocus()) view.performHapticFeedback(HapticFeedbackConstants.CONFIRM)
        lastFeedback = feedback
    }
    val rows = buildList {
        add(WearRow("HARLEM MIGHT"))
        listOf("Now", "Walks", "Events", "Saved").forEach { label ->
            add(WearRow(if (section == label) "• $label" else label, { section = label }))
        }
        fun headline(label: String, card: Card?, empty: String) {
            add(WearRow(label))
            add(WearRow(card?.title ?: empty))
            if (card != null && card.subtitle.isNotBlank()) add(WearRow(card.subtitle))
        }
        when (section) {
            "Now" -> {
                headline("This Is Harlem", feed?.story, "Connect to discover the neighborhood.")
                headline("Happening Today", feed?.event, "No verified event is available.")
            }
            "Events" -> headline("Happening in Harlem", feed?.event, "No currently verified event is available.")
            "Saved" -> headline("My Harlem", null, "Saved places are available on your phone.")
            "Walks" -> {
                val s = walkStore.snapshot
                if (s != null) {
                    add(WearRow(s.getString("walkTitle")))
                    add(WearRow("${s.getInt("completedCount")} of ${s.getInt("totalStops")} stops confirmed"))
                    add(WearRow(s.getString("status")))
                    if (!s.isNull("nextStopTitle")) add(WearRow("Next: ${s.getString("nextStopTitle")}"))
                    add(WearRow(if (s.isNull("instruction")) "Follow the route on your phone. No verified turn guidance is available." else s.getString("instruction")))
                    if (s.getString("status") in listOf("active", "paused")) {
                        if (s.getString("status") == "active" && !s.isNull("nextStopId")) {
                            add(WearRow("Confirm this stop", { confirmation = WalkConfirmation("confirm-stop", s) }, !walkStore.pending))
                        }
                        val active = s.getString("status") == "active"
                        add(WearRow(if (active) "Pause walk" else "Resume walk", { walkStore.send(if (active) "pause" else "resume", s) }, !walkStore.pending))
                        add(WearRow("End walk", { confirmation = WalkConfirmation("stop", s) }, !walkStore.pending))
                    }
                }
                add(WearRow(walkStore.status))
                add(WearRow("Reconnect", { walkStore.reconnect() }, !walkStore.pending))
            }
        }
    }
    MaterialTheme {
        AppScaffold {
            val scrollState = rememberTransformingLazyColumnState()
            val transformation = rememberTransformationSpec()
            ScreenScaffold(scrollState = scrollState) { padding ->
                // TransformingLazyColumn supplies Wear rotary navigation; each
                // control is a separate item rather than one oversized column.
                TransformingLazyColumn(state = scrollState, contentPadding = padding, modifier = Modifier.fillMaxSize()) {
                    items(rows.size) { index ->
                        val row = rows[index]
                        val action = row.action
                        if (action != null) {
                            Button(onClick = action, enabled = row.enabled,
                                modifier = Modifier.fillMaxWidth()
                                    .minimumVerticalContentPadding(ButtonDefaults.minimumVerticalListContentPadding)
                                    .transformedHeight(this, transformation),
                                transformation = SurfaceTransformation(transformation)) { Text(row.label) }
                        } else {
                            Text(row.label, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
                        }
                    }
                }
            }
            AlertDialog(
                visible = confirmation != null,
                onDismissRequest = { confirmation = null },
                title = { Text(if (confirmation?.type == "stop") "End this walk?" else "Confirm your visit?") },
                text = { Text(if (confirmation?.type == "stop") confirmation?.snapshot?.optString("walkTitle") ?: "" else confirmation?.snapshot?.optString("nextStopTitle") ?: "") },
                confirmButton = {
                    AlertDialogDefaults.ConfirmButton(onClick = {
                        val captured = confirmation
                        confirmation = null
                        if (captured != null) walkStore.send(captured.type, captured.snapshot)
                    })
                },
                dismissButton = { AlertDialogDefaults.DismissButton(onClick = { confirmation = null }) },
            )
        }
    }
}
