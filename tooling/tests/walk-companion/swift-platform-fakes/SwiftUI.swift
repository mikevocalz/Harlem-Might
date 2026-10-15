@_exported import Foundation
// Storage and declaration-only surface. No rendering, observation or UI actions.
public protocol ObservableObject: AnyObject {}
@propertyWrapper public struct Published<Value> {
    public var wrappedValue: Value
    public init(wrappedValue: Value) { self.wrappedValue = wrappedValue }
}
@propertyWrapper public struct ObservedObject<Value> {
    public var wrappedValue: Value
    public init(wrappedValue: Value) { self.wrappedValue = wrappedValue }
}
@propertyWrapper public final class State<Value> {
    public var wrappedValue: Value
    public init(wrappedValue: Value) { self.wrappedValue = wrappedValue }
}
public struct Binding<Value> { public init(get: @escaping () -> Value, set: @escaping (Value) -> Void) {} }
public protocol View {
    associatedtype Body: View
    @ViewBuilder var body: Body { get }
}
public extension View { var body: HostView { HostView() } }
public struct HostView: View { public init() {} }
@resultBuilder public enum ViewBuilder {
    public static func buildBlock(_ values: any View...) -> HostView { HostView() }
    public static func buildOptional(_ value: HostView?) -> HostView { HostView() }
    public static func buildEither(first: HostView) -> HostView { first }
    public static func buildEither(second: HostView) -> HostView { second }
}
public struct Text: View { public init(_ text: String) {} }
public struct List: View { public init(@ViewBuilder content: () -> HostView) {} }
public enum Font { case headline, caption }
public enum ButtonRole { case destructive, cancel }
public enum Visibility { case visible }
public struct Button: View { public init(_ text: String, role: ButtonRole? = nil, action: @escaping () -> Void) {} }
public extension View {
    func font(_ font: Font) -> Self { self }
    func disabled(_ value: Bool) -> Self { self }
    func navigationTitle(_ title: String) -> Self { self }
    func confirmationDialog(_ title: String, isPresented: Binding<Bool>, titleVisibility: Visibility,
                            @ViewBuilder actions: () -> HostView) -> Self { self }
}
