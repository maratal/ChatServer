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
    
    /// Custom JSON encoder that uses UNIX timestamps (seconds since 1970) for dates
    private static var jsonEncoder: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .custom { date, encoder in
            // Convert to UNIX timestamp (seconds since January 1, 1970)
            let timestamp = date.timeIntervalSince1970
            var container = encoder.singleValueContainer()
            try container.encode(timestamp)
        }
        return encoder
    }
    
    /// Custom JSON decoder that reads UNIX timestamps (seconds since 1970) for dates
    private static var jsonDecoder: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let timestamp = try container.decode(Double.self)
            return Date(timeIntervalSince1970: timestamp)
        }
        return decoder
    }
    
    /// Converts an `Encodable` object to a raw data.
    func jsonData() throws -> Data {
        try Self.jsonEncoder.encode(self)
    }
    
    /// Converts an `Encodable` object to a JSON object or a [JSON] array.
    func json() throws -> Any {
        try jsonData().json()
    }
    
    /// Converts a raw data to a `Encodable` object.
    static func fromData(_ data: Data) throws -> Self {
        try jsonDecoder.decode(Self.self, from: data)
    }
}

/// Interface for any type to conform for getting a JSON object from it.
protocol JSONSerializable {
    func jsonObject() throws -> JSON
}
