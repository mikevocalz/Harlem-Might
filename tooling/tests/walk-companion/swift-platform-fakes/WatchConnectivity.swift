import Foundation

// Host boundary only: tests explicitly deliver delegate calls and completions.
public enum WCSessionActivationState { case notActivated, inactive, activated }
public protocol WCSessionDelegate: AnyObject {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?)
    func sessionDidBecomeInactive(_ session: WCSession)
    func sessionDidDeactivate(_ session: WCSession)
    func sessionWatchStateDidChange(_ session: WCSession)
    func sessionReachabilityDidChange(_ session: WCSession)
    func session(_ session: WCSession, didReceiveMessage message: [String: Any])
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void)
}
public extension WCSessionDelegate {
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {}
    func sessionWatchStateDidChange(_ session: WCSession) {}
    func sessionReachabilityDidChange(_ session: WCSession) {}
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {}
    func session(_ session: WCSession, didReceiveMessage message: [String: Any], replyHandler: @escaping ([String: Any]) -> Void) {}
}
public final class WCSession {
    public static var `default` = WCSession()
    public static var supported = true
    public static func isSupported() -> Bool { supported }
    public weak var delegate: WCSessionDelegate?
    public var activationState: WCSessionActivationState = .activated
    public var isPaired = true
    public var isWatchAppInstalled = true
    public var isReachable = true
    public private(set) var activations = 0
    public private(set) var sent: [Sent] = []
    public init() {}
    public func activate() { activations += 1 }
    public func sendMessage(_ message: [String: Any], replyHandler: (([String: Any]) -> Void)?, errorHandler: ((Error) -> Void)?) {
        sent.append(Sent(message, replyHandler, errorHandler))
    }
    public final class Sent {
        public let message: [String: Any]
        private let reply: (([String: Any]) -> Void)?
        private let error: ((Error) -> Void)?
        init(_ message: [String: Any], _ reply: (([String: Any]) -> Void)?, _ error: ((Error) -> Void)?) {
            self.message = message; self.reply = reply; self.error = error
        }
        public func succeed(_ value: [String: Any]) { reply?(value) }
        public func fail() { error?(NSError(domain: "HostTransport", code: 1)) }
    }
}
