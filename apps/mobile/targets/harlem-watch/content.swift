import SwiftUI
import Foundation

struct HarlemCard: Codable, Hashable {
    let kind: String
    let title: String
    let subtitle: String
    let eyebrow: String
    let path: String
}

struct HarlemSnapshot: Codable {
    let schemaVersion: Int
    let generatedAt: String
    let expiresAt: String
    let story: HarlemCard?
    let event: HarlemCard?
    let place: HarlemCard?
    let walk: HarlemCard?
}

/// Network-first, offline-aware view state. This public feed contains no
/// authentication data, member names or live coordinates.
@MainActor
final class HarlemWatchStore: ObservableObject {
    @Published private(set) var snapshot: HarlemSnapshot?
    @Published private(set) var statusText = "Loading Harlem…"
    private let cacheKey = "public-harlem-widget-feed-v1"

    init() {
        if let cached = UserDefaults.standard.data(forKey: cacheKey),
           let decoded = try? JSONDecoder().decode(HarlemSnapshot.self, from: cached),
           decoded.schemaVersion == 1 {
            snapshot = decoded
            statusText = "Showing the latest saved highlights"
        }
    }

    var currentEvent: HarlemCard? {
        guard let snapshot, isFresh(snapshot.expiresAt) else { return nil }
        return snapshot.event
    }

    var currentWalk: HarlemCard? {
        guard let snapshot, isFresh(snapshot.expiresAt) else { return nil }
        return snapshot.walk
    }

    private func isFresh(_ timestamp: String) -> Bool {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: timestamp) else { return false }
        return date > Date()
    }

    func refresh() async {
        guard let address = Bundle.main.object(forInfoDictionaryKey: "HARLEM_WIDGET_FEED_URL") as? String,
              let url = URL(string: address), url.scheme == "https",
              url.host != nil else {
            statusText = "Watch feed is not configured yet"
            return
        }
        do {
            var request = URLRequest(url: url)
            request.timeoutInterval = 8
            request.setValue("application/json", forHTTPHeaderField: "Accept")
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                statusText = "Harlem highlights are temporarily unavailable"
                return
            }
            let decoded = try JSONDecoder().decode(HarlemSnapshot.self, from: data)
            guard decoded.schemaVersion == 1 else {
                statusText = "Please update Harlem Might"
                return
            }
            snapshot = decoded
            UserDefaults.standard.set(data, forKey: cacheKey)
            statusText = "Updated"
        } catch {
            statusText = snapshot == nil ? "Connect to see Harlem's stories" : "Showing saved highlights"
        }
    }
}

struct ContentView: View {
    @ObservedObject var store: HarlemWatchStore

    var body: some View {
        TabView {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Harlem Might", systemImage: "building.2")
                            .foregroundStyle(.yellow)
                            .font(.headline)
                        Text("Harlem, wherever you go.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if let story = store.snapshot?.story {
                            CardSection(card: story, leading: "THIS IS HARLEM")
                        } else {
                            EmptySection(title: "Explore Harlem", detail: store.statusText)
                        }
                        if let event = store.currentEvent {
                            CardSection(card: event, leading: "HAPPENING TODAY")
                        }
                    }
                    .padding(.horizontal, 8)
                }
                .navigationTitle("Now")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Refresh", systemImage: "arrow.clockwise") {
                            Task { await store.refresh() }
                        }
                    }
                }
            }
            .tag("now")

            NavigationStack {
                ScrollView {
                    if let walk = store.currentWalk {
                        CardSection(card: walk, leading: "TAKE ME THERE")
                    } else {
                        EmptySection(title: "Take Me There", detail: "Choose a cultural walk on your phone. This watch will show your next stop after the secure handoff is enabled.")
                    }
                }
                .navigationTitle("Walks")
            }
            .tag("walks")

            NavigationStack {
                ScrollView {
                    if let event = store.currentEvent {
                        CardSection(card: event, leading: "VERIFIED EVENT")
                    } else {
                        EmptySection(title: "No current event", detail: "Harlem Might hasn't verified an event for this view.")
                    }
                }
                .navigationTitle("Today")
            }
            .tag("today")

            NavigationStack {
                ScrollView {
                    if let place = store.snapshot?.place {
                        CardSection(card: place, leading: "MY HARLEM")
                    } else {
                        EmptySection(title: "Saved places", detail: "Personal places will appear here after phone/watch account sync.")
                    }
                }
                .navigationTitle("Saved")
            }
            .tag("saved")
        }
        .tabViewStyle(.verticalPage)
    }
}

private struct CardSection: View {
    let card: HarlemCard
    let leading: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(leading)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.yellow)
            Text(card.title)
                .font(.headline)
                .fixedSize(horizontal: false, vertical: true)
            Text(card.subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(.quaternary.opacity(0.25), in: RoundedRectangle(cornerRadius: 12))
        .accessibilityElement(children: .combine)
    }
}

private struct EmptySection: View {
    let title: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            Text(detail).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
    }
}
