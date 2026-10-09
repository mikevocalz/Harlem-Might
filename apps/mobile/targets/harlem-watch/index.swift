import SwiftUI

/// Independent SwiftUI watch app; Apple Targets registers this target in the
/// Expo CNG Xcode project. The phone's Expo Widgets extension is separate.
@main
struct HarlemMightWatchApp: App {
    @StateObject private var store = HarlemWatchStore()

    var body: some Scene {
        WindowGroup {
            ContentView(store: store)
                .tint(Color(red: 248 / 255, green: 198 / 255, blue: 38 / 255))
                .task { await store.refresh() }
        }
    }
}
