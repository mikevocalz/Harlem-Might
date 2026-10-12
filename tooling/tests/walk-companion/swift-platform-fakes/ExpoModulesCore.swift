@_exported import Foundation

// Register and invoke the actual module's closures, without an Expo/JS runtime.
public protocol Module: AnyObject {
    @ModuleDefinitionBuilder func definition() -> ModuleDefinition
}
public enum ModuleEvents {
    public static var sent: [(String, [String: Any])] = []
}
public extension Module {
    func sendEvent(_ name: String, _ event: [String: Any]) { ModuleEvents.sent.append((name, event)) }
}
public struct DefinitionComponent {
    let name: String
    let lifecycle: (() -> Void)?
    let function: (([Any]) throws -> Any)?
    public func runOnQueue(_ queue: FunctionQueue) -> Self { self }
}
public enum FunctionQueue { case main }
public struct ModuleDefinition {
    let components: [DefinitionComponent]
    public func lifecycle(_ name: String) { components.first { $0.name == name }?.lifecycle?() }
    public func call(_ name: String, _ args: Any...) throws -> Any {
        guard let function = components.first(where: { $0.name == name })?.function else {
            throw NSError(domain: "MissingHostFunction", code: 1)
        }
        return try function(args)
    }
}
@resultBuilder public enum ModuleDefinitionBuilder {
    public static func buildBlock(_ components: DefinitionComponent...) -> ModuleDefinition { ModuleDefinition(components: components) }
}
public func Name(_ value: String) -> DefinitionComponent { DefinitionComponent(name: value, lifecycle: nil, function: nil) }
public func Events(_ value: String) -> DefinitionComponent { Name(value) }
private func event(_ name: String, _ body: @escaping () -> Void) -> DefinitionComponent {
    DefinitionComponent(name: name, lifecycle: body, function: nil)
}
public func OnCreate(_ body: @escaping () -> Void) -> DefinitionComponent { event("create", body) }
public func OnStartObserving(_ body: @escaping () -> Void) -> DefinitionComponent { event("start", body) }
public func OnStopObserving(_ body: @escaping () -> Void) -> DefinitionComponent { event("stop", body) }
public func OnAppEntersBackground(_ body: @escaping () -> Void) -> DefinitionComponent { event("background", body) }
public func OnDestroy(_ body: @escaping () -> Void) -> DefinitionComponent { event("destroy", body) }
public func AsyncFunction<Result>(_ name: String, _ body: @escaping () throws -> Result) -> DefinitionComponent {
    DefinitionComponent(name: name, lifecycle: nil, function: { _ in try body() })
}
public func AsyncFunction<Result>(_ name: String, _ body: @escaping (String) throws -> Result) -> DefinitionComponent {
    DefinitionComponent(name: name, lifecycle: nil, function: { args in try body(args[0] as! String) })
}
