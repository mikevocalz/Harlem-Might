import Foundation

// Host execution of the real phone/watch wire source. No transport is simulated.
private struct WireCase: Decodable {
    let name: String
    let accepted: Bool
    let json: String
    let snapshotJSON: String?
}
private struct Fixtures: Decodable {
    let snapshots: [WireCase]
    let commands: [WireCase]
}

@main
struct CompanionWireTests {
    static func main() throws {
        let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
        let fixtures = try JSONDecoder().decode(Fixtures.self, from: data)
        var failures: [String] = []
        for test in fixtures.snapshots {
            let result = CompanionSnapshot.decode(test.json)
            if (result != nil) != test.accepted {
                failures.append("snapshot: \(test.name): expected accepted=\(test.accepted), got \(result != nil)")
            }
            if let result {
                // Re-encoding must preserve every non-null accepted field.
                let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result)) as! NSDictionary
                let original = try JSONSerialization.jsonObject(with: Data(test.json.utf8)) as! NSDictionary
                let expected = original.mutableCopy() as! NSMutableDictionary
                for (key, value) in original where value is NSNull { expected.removeObject(forKey: key) }
                if !encoded.isEqual(expected) { failures.append("snapshot: \(test.name): changed decoded fields") }
            }
        }
        for test in fixtures.commands {
            // Decode a previously installed snapshot without refreshing its expiry.
            // This lets the production command decoder see snapshots that expired
            // after installation, without replacing its real wall-clock check.
            let snapshot = try JSONDecoder().decode(CompanionSnapshot.self, from: Data(test.snapshotJSON!.utf8))
            let result = CompanionCommand.decode(test.json, snapshot: snapshot)
            if (result != nil) != test.accepted {
                failures.append("command: \(test.name): expected accepted=\(test.accepted), got \(result != nil)")
            }
            if let result {
                let encoded = try JSONSerialization.jsonObject(with: JSONEncoder().encode(result)) as! NSDictionary
                let original = try JSONSerialization.jsonObject(with: Data(test.json.utf8)) as! NSDictionary
                if !encoded.isEqual(original) { failures.append("command: \(test.name): changed decoded fields") }
            }
        }
        for failure in failures { FileHandle.standardError.write(Data("\(failure)\n".utf8)) }
        guard failures.isEmpty else {
            throw NSError(domain: "CompanionWireTests", code: 1, userInfo: [NSLocalizedDescriptionKey: "\(failures.count) Swift wire cases failed"])
        }
        print("PASS: \(fixtures.snapshots.count + fixtures.commands.count) Swift wire cases")
    }
}
