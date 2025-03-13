import Foundation

extension String {
    
    var isAlphanumeric: Bool {
        let notAlphanumeric = CharacterSet.decimalDigits.union(CharacterSet.letters).inverted
        return rangeOfCharacter(from: notAlphanumeric, options: String.CompareOptions.literal, range: nil) == nil
    }
    
    func normalized() -> String {
        trimmingCharacters(in: CharacterSet.whitespacesAndNewlines).replacingOccurrences(of: "  ", with: " ")
    }
    
    var isName: Bool {
        !isEmpty && normalized().replacingOccurrences(of: " ", with: "").isAlphanumeric
    }
}

extension Array where Element: Hashable {
    
    func unique() -> [Element] {
        Self(Set(self))
    }
}

extension Data {
    
    /// Converts a raw data to a JSON object or a [JSON] array.
    func json() throws -> Any {
        try JSONSerialization.jsonObject(with: self, options: .allowFragments)
    }
    
    /// Converts a raw data to a JSON object.
    func jsonObject() throws -> JSON? {
        try json() as? JSON
    }
}

extension JSON {
    
    /// Converts a `JSON` object to a raw data.
    func data() throws -> Data {
        try JSONSerialization.data(withJSONObject: self)
    }
}

extension Serializable {
    
    /// Converts an `Encodable` object to a raw data.
    func jsonData() throws -> Data {
        try JSONEncoder().encode(self)
    }
    
    /// Converts an `Encodable` object to a JSON object or a [JSON] array.
    func json() throws -> Any {
        try jsonData().json()
    }
    
    /// Converts a raw data to a `Encodable` object.
    static func fromData(_ data: Data) throws -> Self {
        try JSONDecoder().decode(Self.self, from: data)
    }
}

/// Interface for any type to conform for getting a JSON object from it.
protocol JSONSerializable {
    func jsonObject() throws -> JSON
}
