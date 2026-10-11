import ExpoModulesCore
import WatchConnectivity
import UIKit

public class WalkCompanionModule: Module {
    private let bridge = PhoneWalkBridge()
    public func definition() -> ModuleDefinition {
        Name("WalkCompanion")
        Events("onCommand")
        OnCreate { [weak self] in
            DispatchQueue.main.async {
                self?.bridge.onCommand = { [weak self] json, expiresAt in self?.sendEvent("onCommand", ["json": json, "expiresAt": expiresAt]) }
                self?.bridge.activate()
            }
        }
        OnStartObserving { [weak self] in DispatchQueue.main.async { self?.bridge.observing = true } }
        OnStopObserving { [weak self] in DispatchQueue.main.async { self?.bridge.observing = false; self?.bridge.clear() } }
        OnAppEntersBackground { [weak self] in DispatchQueue.main.async { self?.bridge.clear() } }
        OnDestroy { [weak self] in DispatchQueue.main.async { self?.bridge.clear(); self?.bridge.onCommand = nil } }
        AsyncFunction("createHandoffId") { [weak self] () -> String in
            guard let self else { throw NSError(domain: "WalkCompanion", code: 1) }
            return self.bridge.createHandoffId()
        }.runOnQueue(.main)
        AsyncFunction("getStatus") { [weak self] () -> [String: Bool] in
            self?.bridge.status ?? ["available": false, "reachable": false]
        }.runOnQueue(.main)
        AsyncFunction("publish") { [weak self] (json: String) in
            guard let self else { throw NSError(domain: "WalkCompanion", code: 1) }
            try self.bridge.publish(json)
        }.runOnQueue(.main)
        AsyncFunction("clear") { [weak self] in self?.bridge.clear() }.runOnQueue(.main)
    }
}

/// Foreground, memory-only transport. No application-context cache, queued
/// transferUserInfo, app-group storage, login credentials or background loop.
private final class PhoneWalkBridge: NSObject, WCSessionDelegate {
    var onCommand: ((String, String) -> Void)?
    var observing = false
    private var snapshotJSON: String?
    private var commandIds = Set<String>()
    private var generation = 0
    private var handoffId = ""
    private var authorizedHandoff: String?
    private var expiry: Timer?
    private var session: WCSession? { WCSession.isSupported() ? WCSession.default : nil }
    var status: [String: Bool] {
        ["available": session?.isPaired == true && session?.isWatchAppInstalled == true,
         "reachable": session?.activationState == .activated && session?.isReachable == true]
    }
    func activate() { session?.delegate = self; session?.activate() }
    func createHandoffId() -> String {
        clear()
        let id = UUID().uuidString
        authorizedHandoff = id
        return id
    }
    func publish(_ json: String) throws {
        guard UIApplication.shared.applicationState == .active, observing,
              let next = CompanionSnapshot.decode(json), next.handoffId == authorizedHandoff, let session,
              session.activationState == .activated, session.isPaired, session.isWatchAppInstalled,
              session.isReachable else {
            clear()
            throw NSError(domain: "WalkCompanion", code: 2, userInfo: [NSLocalizedDescriptionKey: "Open both phone and watch apps to share this walk."])
        }
        if let previous = snapshotJSON.flatMap(CompanionSnapshot.decode), previous.handoffId == next.handoffId {
            if previous.sessionId != next.sessionId || previous.revision > next.revision ||
                (previous.revision == next.revision && (CompanionWire.date(previous.updatedAt) ?? .distantFuture) > (CompanionWire.date(next.updatedAt) ?? .distantPast)) {
                throw NSError(domain: "WalkCompanion", code: 3)
            }
        }
        if snapshotJSON.flatMap(CompanionSnapshot.decode)?.handoffId != next.handoffId { commandIds.removeAll() }
        generation += 1
        let operation = generation
        snapshotJSON = json
        handoffId = next.handoffId
        expiry?.invalidate()
        expiry = Timer.scheduledTimer(withTimeInterval: max(0.1, CompanionWire.date(next.expiresAt)?.timeIntervalSinceNow ?? 0), repeats: false) { [weak self] _ in
            if self?.generation == operation { self?.clear() }
        }
        session.sendMessage(["kind": "snapshot", "json": json], replyHandler: nil) { [weak self] _ in
            DispatchQueue.main.async {
                if self?.generation == operation { self?.clear() }
            }
        }
    }
    func clear() {
        generation += 1
        let oldHandoff = handoffId
        handoffId = ""
        authorizedHandoff = nil
        expiry?.invalidate()
        snapshotJSON = nil
        commandIds.removeAll()
        if session?.isReachable == true { session?.sendMessage(["kind": "clear", "handoffId": oldHandoff], replyHandler: nil, errorHandler: nil) }
    }
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) { DispatchQueue.main.async { self.clear() } }
    func sessionDidDeactivate(_ session: WCSession) { DispatchQueue.main.async { self.clear(); session.activate() } }
    func sessionWatchStateDidChange(_ session: WCSession) { DispatchQueue.main.async { self.clear() } }
    func sessionReachabilityDidChange(_ session: WCSession) {
        if !session.isReachable { DispatchQueue.main.async { self.clear() } }
    }
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {
        DispatchQueue.main.async {
            // A paired watch may revoke an expired snapshot or while the phone pauses.
            if message["kind"] as? String == "clear" {
                let cleared = message["handoffId"] as? String ?? ""
                if CompanionWire.text(cleared), cleared == self.handoffId {
                    self.clear()
                    replyHandler(["accepted": true])
                } else { replyHandler(["accepted": false]) }
                return
            }
            guard UIApplication.shared.applicationState == .active, self.observing,
                  let json = self.snapshotJSON, let snapshot = CompanionSnapshot.decode(json) else {
                let rejectedHandoff = message["handoffId"] as? String ?? ""
                if message["kind"] as? String == "request",
                   CompanionWire.text(rejectedHandoff), rejectedHandoff == self.handoffId { self.clear() }
                replyHandler(["kind": "clear", "handoffId": rejectedHandoff]); return
            }
            if message["kind"] as? String == "request" {
                replyHandler(["kind": "snapshot", "json": json]); return
            }
            guard message["kind"] as? String == "command", let commandJSON = message["json"] as? String,
                  let command = CompanionCommand.decode(commandJSON, snapshot: snapshot),
                  self.commandIds.count < 128, !self.commandIds.contains(command.commandId) else {
                replyHandler(["accepted": false]); return
            }
            self.commandIds.insert(command.commandId)
            self.onCommand?(commandJSON, snapshot.expiresAt)
            // Receipt is not a committed revision; watch waits for a new snapshot.
            replyHandler(["accepted": true])
        }
    }
}
