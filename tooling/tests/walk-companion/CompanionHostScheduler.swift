import Foundation

// Names intentionally shadow Foundation's Timer/DispatchQueue only in the host
// executable. Production files are passed verbatim to swiftc. Timer delivery is
// explicit; real Foundation Date/JSON/ISO8601 validation remains in use.
enum DispatchQueue {
    static let main = HostMainQueue()
}
final class HostMainQueue {
    private var work: [() -> Void] = []
    func async(execute body: @escaping () -> Void) { work.append(body) }
    func drain() {
        var count = 0
        while !work.isEmpty {
            count += 1
            precondition(count < 10_000, "Host queue failed to settle")
            work.removeFirst()()
        }
    }
    func reset() { work.removeAll() }
}
final class Timer {
    static var scheduled: [Timer] = []
    let interval: TimeInterval
    let repeats: Bool
    private(set) var isValid = true
    private let body: (Timer) -> Void
    private init(_ interval: TimeInterval, _ repeats: Bool, _ body: @escaping (Timer) -> Void) {
        self.interval = interval; self.repeats = repeats; self.body = body
    }
    static func scheduledTimer(withTimeInterval interval: TimeInterval, repeats: Bool, block: @escaping (Timer) -> Void) -> Timer {
        let timer = Timer(interval, repeats, block); scheduled.append(timer); return timer
    }
    func invalidate() { isValid = false }
    func fire() {
        guard isValid else { return }
        if !repeats { isValid = false }
        body(self)
    }
    static func reset() { scheduled.forEach { $0.invalidate() }; scheduled.removeAll() }
}
