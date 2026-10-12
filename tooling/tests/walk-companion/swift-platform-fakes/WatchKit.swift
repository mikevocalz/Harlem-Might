public enum WKHapticType { case success }
public final class WKInterfaceDevice {
    public static let device = WKInterfaceDevice()
    public private(set) var successes = 0
    public static func current() -> WKInterfaceDevice { device }
    public func play(_ type: WKHapticType) { successes += 1 }
    public func reset() { successes = 0 }
}
