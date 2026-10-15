import Foundation
import ExpoModulesCore
import UIKit
import WatchConnectivity
import WatchKit
#if canImport(Darwin)
import Darwin
#else
import Glibc
#endif

private struct Failure: Error, CustomStringConvertible {
    let description: String
    init(_ description: String) { self.description = description }
}
private func check(_ condition: @autoclosure () throws -> Bool, _ message: String = "Assertion failed") throws {
    if try !condition() { throw Failure(message) }
}
private func rejects(_ body: () throws -> Void) throws {
    do { try body() } catch { return }
    throw Failure("Expected operation to reject")
}
private func drain() { DispatchQueue.main.drain() }
private func json(_ value: [String: Any]) -> String {
    String(data: try! JSONSerialization.data(withJSONObject: value, options: [.sortedKeys]), encoding: .utf8)!
}
private func iso(_ date: Date) -> String {
    let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
}
private func snapshot(_ handoff: String = "epoch", revision: Int = 1, status: String = "active",
                      age: TimeInterval = 0, ttl: TimeInterval = 120, session: String = "walk",
                      completed: Int = 0, haptics: Bool = false) -> String {
    let now = Date()
    let hasStop = ["active", "paused"].contains(status)
    return json(["schemaVersion": 1, "handoffId": handoff, "sessionId": session, "revision": revision,
        "status": status, "walkTitle": "Harlem", "nextStopId": hasStop ? "stop-\(completed)" as Any : NSNull(),
        "nextStopTitle": hasStop ? "Stop \(completed)" as Any : NSNull(), "completedCount": completed,
        "totalStops": 3, "updatedAt": iso(now.addingTimeInterval(-age)), "expiresAt": iso(now.addingTimeInterval(ttl)),
        "routeState": "unavailable", "instruction": NSNull(), "hapticsEnabled": haptics])
}
private func decoded(_ value: String) -> CompanionSnapshot { try! JSONDecoder().decode(CompanionSnapshot.self, from: Data(value.utf8)) }
private func command(_ value: String, id: String = "command", type: String = "pause") -> String {
    let s = decoded(value)
    var fields: [String: Any] = ["schemaVersion": 1, "commandId": id, "sessionId": s.sessionId,
        "handoffId": s.handoffId, "expectedRevision": s.revision, "type": type]
    if ["stop", "confirm-stop"].contains(type) { fields["confirmed"] = true }
    if type == "confirm-stop" { fields["stopId"] = s.nextStopId }
    return json(fields)
}
private extension WCSession {
    func last(_ kind: String) -> Sent { sent.last { $0.message["kind"] as? String == kind }! }
    func count(_ kind: String) -> Int { sent.filter { $0.message["kind"] as? String == kind }.count }
}
private final class Phone {
    let session: WCSession
    let module: WalkCompanionModule
    let definition: ModuleDefinition
    init(observing: Bool = true) {
        let endpoint = WCSession(); session = endpoint; WCSession.default = endpoint
        let created = WalkCompanionModule(); module = created; definition = created.definition()
        event("create"); if observing { event("start") }
    }
    func use() { WCSession.default = session }
    func event(_ name: String) { use(); definition.lifecycle(name); drain() }
    func share() throws -> String { use(); return try definition.call("createHandoffId") as! String }
    func publish(_ value: String) throws { use(); _ = try definition.call("publish", value) }
    func clear() throws { use(); _ = try definition.call("clear") }
    func receive(_ message: [String: Any]) -> [String: Any] {
        use(); var reply: [String: Any] = [:]
        session.delegate!.session(session, didReceiveMessage: message) { reply = $0 }; drain(); return reply
    }
    func request(_ handoff: String = "") -> [String: Any] { receive(["kind": "request", "handoffId": handoff]) }
    func command(_ value: String) -> Bool { receive(["kind": "command", "json": value])["accepted"] as? Bool == true }
}
private final class Watch {
    let session: WCSession
    let store: WatchWalkStore
    init(foreground: Bool = true) {
        let endpoint = WCSession(); session = endpoint; WCSession.default = endpoint; store = WatchWalkStore()
        if foreground { store.setForeground(true) }
    }
    func use() { WCSession.default = session }
    func receive(_ value: String) { message(["kind": "snapshot", "json": value]) }
    func message(_ message: [String: Any]) {
        use(); session.delegate!.session(session, didReceiveMessage: message); drain()
    }
    func clear(_ handoff: String) { message(["kind": "clear", "handoffId": handoff]) }
    func send(_ type: String = "pause", expected: CompanionSnapshot? = nil) {
        use(); store.send(type, expected: expected ?? store.snapshot!)
    }
}

@main
struct CompanionLifecycleTests {
    static func main() {
        var count = 0
        var failures: [String] = []
        let selected = Set(CommandLine.arguments.dropFirst())
        func test(_ name: String, _ body: () throws -> Void) {
            guard selected.isEmpty || selected.contains(name) else { return }
            DispatchQueue.main.reset(); Timer.reset(); WCSession.default = WCSession(); WCSession.supported = true
            UIApplication.shared.applicationState = .active; ModuleEvents.sent.removeAll(); WKInterfaceDevice.device.reset()
            do { try body(); print("PASS: \(name)") }
            catch { failures.append("\(name): \(error)"); print("FAIL: \(name): \(error)") }
            count += 1
        }
        test("phone requires observation, foreground, support and live pairing") {
            let p = Phone(observing: false)
            try rejects { _ = try p.share() }
            p.event("start")
            for state in [UIApplication.State.inactive, .background] {
                UIApplication.shared.applicationState = state; try rejects { _ = try p.share() }
            }
            UIApplication.shared.applicationState = .active
            WCSession.supported = false; try rejects { _ = try p.share() }; WCSession.supported = true
            p.session.isPaired = false; try rejects { _ = try p.share() }; p.session.isPaired = true
            p.session.isWatchAppInstalled = false; try rejects { _ = try p.share() }; p.session.isWatchAppInstalled = true
            p.session.isReachable = false; try rejects { _ = try p.share() }; p.session.isReachable = true
            p.session.activationState = .inactive; try rejects { _ = try p.share() }; p.session.activationState = .activated
            try check(!(try p.share()).isEmpty)
        }
        test("phone reports current availability and reachability") {
            let p = Phone()
            let status = try p.definition.call("getStatus") as! [String: Bool]
            try check(status == ["available": true, "reachable": true]); try check(p.session.activations == 1)
            p.session.isWatchAppInstalled = false; p.session.isReachable = false
            try check(try p.definition.call("getStatus") as! [String: Bool] == ["available": false, "reachable": false])
        }
        for event in ["background", "stop", "destroy"] {
            test("phone \(event) clears snapshot, expiry and old authority") {
                let p = Phone(); let value = snapshot(try p.share()); try p.publish(value)
                let expiry = Timer.scheduled.last!
                p.event(event)
                try check(!expiry.isValid); try check(p.request()["kind"] as? String == "clear")
                try check(!p.command(command(value))); try check(ModuleEvents.sent.isEmpty)
                try rejects { try p.publish(value) }
            }
            test("phone \(event) revokes authority before first publication") {
                let p = Phone(); let value = snapshot(try p.share()); p.event(event)
                try rejects { try p.publish(value) }
            }
        }
        test("phone observer restart needs an explicit fresh handoff") {
            let p = Phone(); let old = snapshot(try p.share()); try p.publish(old)
            p.event("stop"); p.event("start"); try rejects { try p.publish(old) }
            let next = snapshot(try p.share()); try p.publish(next)
            try check(p.request()["json"] as? String == next)
        }
        test("phone expiry revokes snapshot and authorization") {
            let p = Phone(); let value = snapshot(try p.share(), ttl: 60); try p.publish(value)
            let expiry = Timer.scheduled.last!
            try check(expiry.interval > 59 && expiry.interval <= 60); try check(!expiry.repeats)
            expiry.fire(); try check(p.request()["kind"] as? String == "clear")
            try check(p.session.last("clear").message["handoffId"] as? String == decoded(value).handoffId)
            try rejects { try p.publish(value) }
        }
        test("phone rejects expired input and clears the prior projection") {
            let p = Phone(); let id = try p.share(); try p.publish(snapshot(id))
            try rejects { try p.publish(snapshot(id, age: 10, ttl: -1)) }
            try check(p.request()["kind"] as? String == "clear")
        }
        test("phone replacement cancels old expiry and ignores stale send errors") {
            let p = Phone(); let id = try p.share(); try p.publish(snapshot(id))
            let first = p.session.last("snapshot"); let timer = Timer.scheduled.last!
            let next = snapshot(id, revision: 2); try p.publish(next)
            try check(!timer.isValid); timer.fire(); first.fail(); drain()
            try check(p.request()["json"] as? String == next)
            p.session.last("snapshot").fail(); drain()
            try check(p.request()["kind"] as? String == "clear")
        }
        test("phone old errors and clears cannot revoke a newer handoff") {
            let p = Phone(); let old = snapshot(try p.share()); try p.publish(old); let send = p.session.last("snapshot")
            let next = snapshot(try p.share()); try p.publish(next)
            send.fail(); drain()
            try check(p.receive(["kind": "clear", "handoffId": decoded(old).handoffId])["accepted"] as? Bool == false)
            try check(p.request()["json"] as? String == next)
            try check(p.receive(["kind": "clear", "handoffId": decoded(next).handoffId])["accepted"] as? Bool == true)
            try check(p.request()["kind"] as? String == "clear")
        }
        test("phone rejects regression, timestamp rollback and session replacement within a handoff") {
            let p = Phone(); let id = try p.share(); let current = snapshot(id, revision: 4); try p.publish(current)
            for bad in [snapshot(id, revision: 3), snapshot(id, revision: 4, age: 10), snapshot(id, revision: 5, session: "other")] {
                try rejects { try p.publish(bad) }; try check(p.request()["json"] as? String == current)
            }
        }
        for event in ["reachability", "pairing", "inactive", "deactivate"] {
            test("phone \(event) revokes both pending and published handoffs") {
                for publish in [false, true] {
                    let p = Phone(); let value = snapshot(try p.share()); if publish { try p.publish(value) }
                    let delegate = p.session.delegate!
                    switch event {
                    case "reachability": p.session.isReachable = false; delegate.sessionReachabilityDidChange(p.session)
                    case "pairing": p.session.isPaired = false; delegate.sessionWatchStateDidChange(p.session)
                    case "inactive": delegate.sessionDidBecomeInactive(p.session)
                    default: delegate.sessionDidDeactivate(p.session)
                    }
                    drain(); p.session.isReachable = true; p.session.isPaired = true
                    try rejects { try p.publish(value) }
                    if event == "deactivate" { try check(p.session.activations == 2) }
                }
            }
        }
        test("phone command replay cap and exact expiry event") {
            let p = Phone(); let value = snapshot(try p.share()); try p.publish(value)
            for id in 0..<128 { try check(p.command(command(value, id: "action-\(id)"))) }
            try check(!p.command(command(value, id: "action-0"))); try check(!p.command(command(value, id: "overflow")))
            try check(ModuleEvents.sent.count == 128)
            try check(ModuleEvents.sent.allSatisfy { $0.0 == "onCommand" && $0.1["expiresAt"] as? String == decoded(value).expiresAt })
            let next = snapshot(try p.share()); try p.publish(next)
            try check(p.command(command(next, id: "action-0")))
        }
        test("phone rejects mismatched commands without emitting to JavaScript") {
            let p = Phone(); let id = try p.share(); let value = snapshot(id); try p.publish(value)
            for bad in [command(snapshot("other")), command(snapshot(id, revision: 2)), command(snapshot(id, session: "other")), "{}"] {
                try check(!p.command(bad))
            }
            try check(ModuleEvents.sent.isEmpty)
        }
        test("phone queued command rechecks current pairing before delivery") {
            let p = Phone(); let value = snapshot(try p.share()); try p.publish(value)
            var accepted = false
            p.session.delegate!.session(p.session, didReceiveMessage: ["kind": "command", "json": command(value)]) {
                accepted = $0["accepted"] as? Bool == true
            }
            p.session.isPaired = false
            drain()
            try check(!accepted, "Queued command was accepted after unpairing")
            try check(ModuleEvents.sent.isEmpty, "Queued command escaped to JS after unpairing")
        }
        test("watch initializes and only requests a snapshot in the foreground") {
            let w = Watch(foreground: false); try check(w.session.activations == 1)
            w.receive(snapshot()); try check(w.store.snapshot == nil); try check(w.session.count("request") == 0)
            w.store.setForeground(true); try check(w.session.count("request") == 1)
        }
        test("watch ignores stale reconnect replies and errors after adoption") {
            let w = Watch(); let request = w.session.last("request"); w.receive(snapshot("new"))
            request.succeed(["kind": "snapshot", "json": snapshot("old")]); request.fail(); drain()
            try check(w.store.snapshot?.handoffId == "new")
        }
        test("watch newer reconnect supersedes old replies and errors") {
            let w = Watch(); let first = w.session.last("request"); w.store.reconnect(); let second = w.session.last("request")
            first.succeed(["kind": "snapshot", "json": snapshot("old")]); first.fail(); drain()
            try check(w.store.snapshot == nil)
            second.succeed(["kind": "snapshot", "json": snapshot("new")]); drain()
            try check(w.store.snapshot?.handoffId == "new")
        }
        test("watch same-handoff push supersedes pending reconnect errors") {
            let w = Watch(); w.receive(snapshot()); w.store.reconnect(); let request = w.session.last("request")
            w.receive(snapshot(revision: 2)); request.fail(); drain()
            try check(w.store.snapshot?.revision == 2)
        }
        test("watch background clears pending work and ignores late callbacks") {
            let w = Watch(); w.receive(snapshot()); w.send(); let send = w.session.last("command")
            w.store.setForeground(false)
            try check(w.store.snapshot == nil && !w.store.pending)
            try check(Timer.scheduled.allSatisfy { !$0.isValid })
            try check(w.session.last("clear").message["handoffId"] as? String == "epoch")
            send.fail(); drain(); w.receive(snapshot("late")); try check(w.store.snapshot == nil)
        }
        test("watch clear overtaking first snapshot tombstones the epoch") {
            let w = Watch(); w.clear("old"); w.receive(snapshot("old"))
            try check(w.store.snapshot == nil); try check(w.session.last("clear").message["handoffId"] as? String == "old")
            w.receive(snapshot("fresh")); try check(w.store.snapshot?.handoffId == "fresh")
        }
        test("watch stale clears do not erase current guidance or echo phone clears") {
            let w = Watch(); w.receive(snapshot("new")); let clears = w.session.count("clear")
            w.clear("old"); try check(w.store.snapshot?.handoffId == "new")
            w.clear("new"); try check(w.store.snapshot == nil); try check(w.session.count("clear") == clears)
        }
        test("watch rejects old epochs, regressions and invalid projection") {
            let w = Watch(); w.receive(snapshot("old")); w.receive(snapshot("new", revision: 4))
            for bad in [snapshot("old", revision: 5), snapshot("new", revision: 3), snapshot("new", revision: 4, age: 10),
                        snapshot("new", revision: 5, session: "other"), snapshot("bad", age: 10, ttl: -1), "{}"] { w.receive(bad) }
            try check(w.store.snapshot?.handoffId == "new" && w.store.snapshot?.revision == 4)
        }
        test("watch replacement cancels expiry and current expiry clears guidance") {
            let w = Watch(); w.receive(snapshot()); let old = Timer.scheduled.last!
            w.receive(snapshot(revision: 2)); let current = Timer.scheduled.last!
            try check(!old.isValid); old.fire(); try check(w.store.snapshot?.revision == 2)
            current.fire(); try check(w.store.snapshot == nil); try check(w.store.status.contains("expired"))
            w.receive(snapshot()); try check(w.store.snapshot == nil)
        }
        test("watch reachability loss clears and reconnect cannot restore revoked epoch") {
            let w = Watch(); w.receive(snapshot()); w.session.isReachable = false
            w.session.delegate!.sessionReachabilityDidChange(w.session); drain()
            try check(!w.store.reachable && w.store.snapshot == nil)
            w.session.isReachable = true; w.store.reconnect()
            w.session.last("request").succeed(["kind": "snapshot", "json": snapshot()]); drain()
            try check(w.store.snapshot == nil)
        }
        test("watch disconnected delivery cannot install an unseen handoff") {
            let w = Watch(); w.receive(snapshot("old")); w.session.isReachable = false
            w.session.delegate!.sessionReachabilityDidChange(w.session)
            w.session.delegate!.session(w.session, didReceiveMessage: ["kind": "snapshot", "json": snapshot("late-new")])
            drain()
            try check(w.store.snapshot == nil, "Queued snapshot restored guidance after disconnect")
            try check(!w.store.reachable)
        }
        test("watch rejects stale dialog snapshots and commands while pending") {
            let w = Watch(); w.receive(snapshot()); let expected = w.store.snapshot!
            w.receive(snapshot(revision: 2)); w.send("stop", expected: expected)
            try check(w.session.count("command") == 0)
            w.send(); w.send(); try check(w.session.count("command") == 1)
        }
        test("watch transport receipt is not authoritative confirmation") {
            let w = Watch(); w.receive(snapshot(haptics: true)); w.send()
            w.session.last("command").succeed(["accepted": true]); drain()
            try check(w.store.pending && w.store.snapshot?.status == "active"); try check(WKInterfaceDevice.device.successes == 0)
            w.receive(snapshot(revision: 2, status: "paused", haptics: true))
            try check(!w.store.pending && w.store.status == "Confirmed on your phone.")
            try check(WKInterfaceDevice.device.successes == 1)
        }
        test("watch only matching state confirmation produces success feedback") {
            for haptics in [false, true] {
                let w = Watch(); w.receive(snapshot(haptics: haptics)); w.send("confirm-stop")
                w.receive(snapshot(revision: 2, completed: 1, haptics: haptics))
                try check(!w.store.pending); try check(w.store.status == "Confirmed on your phone.")
            }
            try check(WKInterfaceDevice.device.successes == 1)
            let w = Watch(); w.receive(snapshot(haptics: true)); w.send()
            w.receive(snapshot(revision: 2, haptics: true))
            try check(!w.store.pending); try check(WKInterfaceDevice.device.successes == 1)
        }
        test("watch timeout conveys uncertainty and late receipt cannot confirm") {
            let w = Watch(); w.receive(snapshot()); w.send(); let send = w.session.last("command")
            let timeout = Timer.scheduled.last!; try check(timeout.interval == 10 && !timeout.repeats)
            timeout.fire(); try check(!w.store.pending); try check(w.store.status.contains("No confirmation received"))
            send.succeed(["accepted": true]); send.fail(); drain()
            try check(w.store.snapshot != nil && w.store.status.contains("No confirmation received"))
        }
        test("watch newer handoff owns command callbacks and expiry") {
            let w = Watch(); w.receive(snapshot("old")); w.send(); let send = w.session.last("command")
            let oldTimers = Timer.scheduled
            w.receive(snapshot("new")); send.fail(); send.succeed(["accepted": false]); drain()
            try check(w.store.snapshot?.handoffId == "new" && !w.store.pending)
            try check(oldTimers.allSatisfy { !$0.isValid })
        }
        test("watch rejected command requests current authority without optimistic change") {
            let w = Watch(); w.receive(snapshot()); w.send(); let before = w.session.count("request")
            w.session.last("command").succeed(["accepted": false]); drain()
            try check(!w.store.pending && w.store.snapshot?.revision == 1)
            try check(w.session.count("request") == before + 1)
        }
        test("actual phone and watch relay publication, command, confirmation and revocation") {
            let p = Phone(); let value = snapshot(try p.share(), haptics: true); try p.publish(value)
            let w = Watch(); w.message(p.session.last("snapshot").message); w.send()
            let outbound = w.session.last("command"); let reply = p.receive(outbound.message)
            w.use(); outbound.succeed(reply); drain(); try check(w.store.pending)
            try check(ModuleEvents.sent.count == 1)
            let next = snapshot(decoded(value).handoffId, revision: 2, status: "paused", haptics: true)
            try p.publish(next); w.message(p.session.last("snapshot").message)
            try check(!w.store.pending && w.store.snapshot?.status == "paused")
            try check(WKInterfaceDevice.device.successes == 1)
            p.event("background"); w.message(p.session.last("clear").message); try check(w.store.snapshot == nil)
        }
        guard count > 0 else {
            FileHandle.standardError.write(Data("No Swift lifecycle tests selected\n".utf8)); exit(2)
        }
        guard failures.isEmpty else {
            FileHandle.standardError.write(Data("FAIL: \(failures.count)/\(count) Swift lifecycle cases\n".utf8)); exit(1)
        }
        print("PASS: \(count) Swift lifecycle/callback cases (host platform fakes; no Apple runtime/device claim)")
    }
}
