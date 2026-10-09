package com.harlemmight.watch

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** The Wear OS app browses publicly curated content without phone pairing.
 * Paired secure member data and active walk sync are a separate integration.
 */
private data class Card(val title: String, val subtitle: String)
private data class Feed(val story: Card?, val event: Card?, val place: Card?, val walk: Card?)

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
        Feed(card(payload, "story"), card(payload, "event"), null, null)
        // Public feed deliberately excludes personal saved places and active walks.
    } catch (_: Exception) { null }
    finally { connection.disconnect() }
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { HarlemWearApp() }
    }
}

@Composable
private fun HarlemWearApp() {
    var feed by remember { mutableStateOf<Feed?>(null) }
    var section by rememberSaveable { mutableStateOf("Now") }
    LaunchedEffect(Unit) { feed = loadFeed() }
    MaterialTheme {
        AppScaffold {
            val scrollState = rememberScrollState()
            ScreenScaffold(scrollState = scrollState) { padding ->
                Column(
                    modifier = Modifier.fillMaxSize().verticalScroll(scrollState).padding(padding).padding(horizontal = 12.dp),
                ) {
                    Text("HARLEM MIGHT", color = Color(0xFFF8C626), fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    listOf("Now", "Walks", "Events", "Saved").forEach { label ->
                        Button(onClick = { section = label }, modifier = Modifier.padding(vertical = 2.dp)) {
                            Text(if (section == label) "• $label" else label)
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    when (section) {
                        "Now" -> {
                            Headline("This Is Harlem", feed?.story, "Connect to discover the neighborhood.")
                            Headline("Happening Today", feed?.event, "No verified event is available.")
                        }
                        "Walks" -> Headline("Take Me There", feed?.walk,
                            "Choose a cultural walk on your phone. Paired walk sync is coming.")
                        "Events" -> Headline("Happening in Harlem", feed?.event,
                            "No currently verified event is available.")
                        "Saved" -> Headline("My Harlem", feed?.place,
                            "Member saves will appear after secure phone/watch sync.")
                    }
                }
            }
        }
    }
}

@Composable
private fun Headline(label: String, card: Card?, empty: String) {
    Text(label, color = Color(0xFFF8C626), fontWeight = FontWeight.SemiBold)
    Text(card?.title ?: empty)
    if (card != null) Text(card.subtitle)
    Spacer(Modifier.height(12.dp))
}
