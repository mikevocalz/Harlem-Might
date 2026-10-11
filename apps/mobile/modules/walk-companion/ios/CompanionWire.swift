import Foundation

// Kept byte-identical to the watch target copy; checked by the protocol tests.
struct CompanionSnapshot: Codable {
    let schemaVersion: Int
    let handoffId: String
    let sessionId: String
    let revision: Int
    let status: String
    let walkTitle: String
    let nextStopId: String?
    let nextStopTitle: String?
    let completedCount: Int
    let totalStops: Int
    let updatedAt: String
    let expiresAt: String
    let routeState: String
    let instruction: String?
    let hapticsEnabled: Bool

    var isFresh: Bool {
        guard let updated = CompanionWire.date(updatedAt), let expires = CompanionWire.date(expiresAt) else { return false }
        let now = Date()
        return updated.timeIntervalSince(now) <= 30 && expires > now && expires > updated &&
            expires.timeIntervalSince(updated) <= 300 && now.timeIntervalSince(updated) <= 300
    }
    static func decode(_ json: String) -> CompanionSnapshot? {
        let keys: Set<String> = ["schemaVersion", "handoffId", "sessionId", "revision", "status", "walkTitle", "nextStopId", "nextStopTitle", "completedCount", "totalStops", "updatedAt", "expiresAt", "routeState", "instruction", "hapticsEnabled"]
        guard let data = CompanionWire.data(json, keys: keys, required: keys),
              let s = try? JSONDecoder().decode(Self.self, from: data), s.schemaVersion == 1,
              CompanionWire.text(s.handoffId), CompanionWire.text(s.sessionId), CompanionWire.text(s.walkTitle),
              s.revision >= 0, s.revision <= 9_007_199_254_740_991,
              ["active", "paused", "completed", "stopped"].contains(s.status),
              ["ready", "offline", "unavailable"].contains(s.routeState),
              s.totalStops > 0, s.totalStops <= 100, s.completedCount >= 0, s.completedCount <= s.totalStops,
              (s.nextStopId == nil) == (s.nextStopTitle == nil),
              s.nextStopId.map({ CompanionWire.text($0) }) ?? true,
              s.nextStopTitle.map({ CompanionWire.text($0) }) ?? true,
              s.instruction.map({ CompanionWire.text($0, max: 500) }) ?? true, s.isFresh else { return nil }
        return s
    }
}

struct CompanionCommand: Codable {
    let schemaVersion: Int
    let commandId: String
    let sessionId: String
    let handoffId: String
    let expectedRevision: Int
    let type: String
    let confirmed: Bool?
    let stopId: String?

    static func decode(_ json: String, snapshot s: CompanionSnapshot) -> CompanionCommand? {
        let keys: Set<String> = ["schemaVersion", "commandId", "sessionId", "handoffId", "expectedRevision", "type", "confirmed", "stopId"]
        guard let data = CompanionWire.data(json, keys: keys),
              let c = try? JSONDecoder().decode(Self.self, from: data), c.schemaVersion == 1,
              CompanionWire.text(c.commandId), c.sessionId == s.sessionId, c.handoffId == s.handoffId,
              c.expectedRevision == s.revision, s.isFresh,
              ["pause", "resume", "stop", "confirm-stop"].contains(c.type),
              c.confirmed == nil || c.confirmed == true,
              !["stop", "confirm-stop"].contains(c.type) || c.confirmed == true,
              c.type == "confirm-stop" ? (c.stopId != nil && c.stopId == s.nextStopId) : c.stopId == nil else { return nil }
        return c
    }
}

enum CompanionWire {
    static func text(_ value: String, max: Int = 160) -> Bool { !value.isEmpty && value.count <= max }
    static func data(_ json: String, keys: Set<String>, required: Set<String> = []) -> Data? {
        guard let data = json.data(using: .utf8), data.count <= 8_192,
              let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(value.keys).isSubset(of: keys), required.isSubset(of: Set(value.keys)) else { return nil }
        return data
    }
    static func date(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}
