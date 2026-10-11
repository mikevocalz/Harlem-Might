import SwiftUI
import WatchConnectivity
import WatchKit

/// The paired journey is foreground-only. Public highlights remain independent.
/// Private snapshots expire in memory and are never written to UserDefaults.
final class WatchWalkStore: NSObject, ObservableObject, WCSessionDelegate {
    @Published private(set) var snapshot: CompanionSnapshot?
    @Published private(set) var status = "Open Harlem Might on your phone and share a walk."
    @Published private(set) var reachable = false
    @Published private(set) var pending = false
    private var foreground = false
    private var timeout: Timer?
    private var expiry: Timer?
    private var pendingCommand: CompanionCommand?
    private var pendingCount = 0
    private var invalidHandoffs = Set<String>()
    private var generation = 0
    private var reconnectGeneration = 0

    override init() {
        super.init()
        if WCSession.isSupported() { WCSession.default.delegate = self; WCSession.default.activate() }
    }
    func setForeground(_ active: Bool) {
        foreground = active
        if active { reconnect() } else { clear("Open the watch and phone to reconnect.") }
    }
    func reconnect() {
        let session = WCSession.default
        reachable = foreground && session.activationState == .activated && session.isReachable
        guard reachable else { clear("Phone disconnected. Open both apps to reconnect."); return }
        let operation = generation
        reconnectGeneration += 1
        let request = reconnectGeneration
        session.sendMessage(["kind": "request", "handoffId": snapshot?.handoffId ?? ""], replyHandler: { [weak self] message in
            DispatchQueue.main.async { if self?.generation == operation && self?.reconnectGeneration == request { self?.receive(message) } }
        }, errorHandler: { [weak self] _ in
            DispatchQueue.main.async { if self?.generation == operation && self?.reconnectGeneration == request { self?.clear("Phone disconnected. Open both apps to reconnect.") } }
        })
    }
    private func notifyPhoneCleared(_ handoff: String) {
        let session = WCSession.default
        guard CompanionWire.text(handoff), session.activationState == .activated, session.isReachable else { return }
        session.sendMessage(["kind": "clear", "handoffId": handoff], replyHandler: { _ in }, errorHandler: nil)
    }
    func clear(_ reason: String, notifyPhone: Bool = true) {
        generation += 1
        if let snapshot {
            invalidHandoffs.insert(snapshot.handoffId)
            if notifyPhone { notifyPhoneCleared(snapshot.handoffId) }
        }
        snapshot = nil; pending = false; pendingCommand = nil
        timeout?.invalidate(); expiry?.invalidate(); status = reason
    }
    private func receive(_ message: [String: Any]) {
        guard foreground else { return }
        if message["kind"] as? String == "clear" {
            let cleared = message["handoffId"] as? String ?? ""
            // A clear may overtake its snapshot. Tombstone that epoch even if
            // it was never rendered; a delayed snapshot must not resurrect it.
            if CompanionWire.text(cleared) { invalidHandoffs.insert(cleared) }
            if cleared == snapshot?.handoffId { clear("Share your walk again from the phone.", notifyPhone: false) }
            return
        }
        guard message["kind"] as? String == "snapshot", let json = message["json"] as? String,
              let next = CompanionSnapshot.decode(json) else { return }
        if invalidHandoffs.contains(next.handoffId) { notifyPhoneCleared(next.handoffId); return }
        if let previous = snapshot {
            if previous.handoffId == next.handoffId && (previous.sessionId != next.sessionId || next.revision < previous.revision ||
                (previous.revision == next.revision && (CompanionWire.date(previous.updatedAt) ?? .distantFuture) > (CompanionWire.date(next.updatedAt) ?? .distantPast))) { return }
        }
        // Any accepted phone snapshot supersedes older reconnect replies/errors,
        // even within one handoff. Keep command timeout/ack generations intact.
        reconnectGeneration += 1
        if snapshot?.handoffId != next.handoffId {
            // First adoption also supersedes any older reconnect callback.
            generation += 1
            if let previous = snapshot { invalidHandoffs.insert(previous.handoffId) }
            pending = false; pendingCommand = nil; timeout?.invalidate()
        }
        let command = pendingCommand
        let matches = command?.handoffId == next.handoffId && command?.sessionId == next.sessionId &&
            next.revision > (command?.expectedRevision ?? Int.max)
        let confirmed = matches && (
            (command?.type == "confirm-stop" && next.completedCount == pendingCount + 1) ||
            (command?.type == "stop" && next.status == "stopped") ||
            (command?.type == "pause" && next.status == "paused") ||
            (command?.type == "resume" && next.status == "active"))
        snapshot = next; reachable = WCSession.default.isReachable
        if matches { pending = false; pendingCommand = nil; timeout?.invalidate() }
        status = confirmed ? "Confirmed on your phone." : "Paired phone guidance · \(next.routeState)"
        // Haptic follows an acknowledged state change, never mere delivery/GPS.
        if confirmed && next.hapticsEnabled { WKInterfaceDevice.current().play(.success) }
        expiry?.invalidate()
        let remaining = CompanionWire.date(next.expiresAt)?.timeIntervalSinceNow ?? 0
        expiry = Timer.scheduledTimer(withTimeInterval: max(0.1, remaining), repeats: false) { [weak self] _ in
            self?.clear("Guidance expired. Share a fresh walk from your phone.")
        }
    }
    func send(_ type: String, expected: CompanionSnapshot) {
        guard foreground, reachable, !pending, let snapshot, snapshot.isFresh,
              expected.handoffId == snapshot.handoffId, expected.sessionId == snapshot.sessionId,
              expected.revision == snapshot.revision, expected.nextStopId == snapshot.nextStopId,
              WCSession.default.isReachable else { status = "Reconnect before changing your walk."; return }
        let command = CompanionCommand(schemaVersion: 1, commandId: UUID().uuidString,
            sessionId: snapshot.sessionId, handoffId: snapshot.handoffId, expectedRevision: snapshot.revision,
            type: type, confirmed: ["stop", "confirm-stop"].contains(type) ? true : nil,
            stopId: type == "confirm-stop" ? snapshot.nextStopId : nil)
        guard let data = try? JSONEncoder().encode(command), let json = String(data: data, encoding: .utf8),
              CompanionCommand.decode(json, snapshot: snapshot) != nil else { return }
        pending = true; pendingCommand = command; pendingCount = snapshot.completedCount
        status = "Waiting for your phone to confirm…"
        generation += 1
        let operation = generation
        timeout?.invalidate()
        timeout = Timer.scheduledTimer(withTimeInterval: 10, repeats: false) { [weak self] _ in
            guard self?.generation == operation, self?.pendingCommand?.commandId == command.commandId else { return }
            self?.pending = false; self?.pendingCommand = nil
            self?.status = "No confirmation received. Check the phone before retrying."
        }
        WCSession.default.sendMessage(["kind": "command", "json": json], replyHandler: { [weak self] reply in
            if reply["accepted"] as? Bool != true {
                DispatchQueue.main.async {
                    guard self?.generation == operation, self?.pendingCommand?.commandId == command.commandId else { return }
                    self?.pending = false; self?.pendingCommand = nil; self?.reconnect()
                }
            }
        }, errorHandler: { [weak self] _ in
            DispatchQueue.main.async {
                if self?.generation == operation && self?.pendingCommand?.commandId == command.commandId { self?.clear("Phone disconnected. Nothing was queued.") }
            }
        })
    }
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async { if self.foreground { self.reconnect() } }
    }
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.reachable = session.isReachable && self.foreground
            if !self.reachable { self.clear("Phone disconnected. Share again after reconnecting.") }
        }
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        DispatchQueue.main.async { self.receive(message) }
    }
}

struct PairedWalkView: View {
    @ObservedObject var store: WatchWalkStore
    @State private var confirmation: String?
    @State private var confirmationSnapshot: CompanionSnapshot?
    var body: some View {
        List {
            if let snapshot = store.snapshot {
                Text(snapshot.walkTitle).font(.headline)
                Text("\(snapshot.completedCount) of \(snapshot.totalStops) stops confirmed")
                Text(snapshot.status.capitalized)
                if let title = snapshot.nextStopTitle { Text("Next: \(title)").font(.headline) }
                Text(snapshot.instruction ?? "Follow the route on your phone. No verified turn guidance is available.")
                Text(store.status).font(.caption)
                if snapshot.status == "active" || snapshot.status == "paused" {
                    if snapshot.status == "active" && snapshot.nextStopId != nil {
                        Button("Confirm this stop") { confirmationSnapshot = snapshot; confirmation = "confirm-stop" }
                    }
                    Button(snapshot.status == "active" ? "Pause walk" : "Resume walk") {
                        store.send(snapshot.status == "active" ? "pause" : "resume", expected: snapshot)
                    }
                    Button("End walk", role: .destructive) { confirmationSnapshot = snapshot; confirmation = "stop" }
                }
            } else { Text(store.status) }
            Button("Reconnect") { store.reconnect() }
        }
        .disabled(store.pending)
        .confirmationDialog(confirmation == "stop" ? "End \(confirmationSnapshot?.walkTitle ?? "this walk")?" : "Confirm your visit to \(confirmationSnapshot?.nextStopTitle ?? "this stop")?",
            isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }),
            titleVisibility: .visible) {
                Button(confirmation == "stop" ? "End walk" : "Confirm visit") {
                    if let confirmation, let expected = confirmationSnapshot { store.send(confirmation, expected: expected) }
                    confirmation = nil; confirmationSnapshot = nil
                }
                Button("Cancel", role: .cancel) { confirmation = nil }
            }
        .navigationTitle("Take Me There")
    }
}
