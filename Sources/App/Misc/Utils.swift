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

extension Serializable {
    
    func jsonData() throws -> Data {
        try JSONEncoder().encode(self)
    }
    
    func json() throws -> Any {
        try JSONSerialization.jsonObject(with: jsonData(), options: .allowFragments)
    }
    
    static func fromData(_ data: Data) throws -> Self {
        try JSONDecoder().decode(Self.self, from: data)
    }
}

extension JSON {
    
    func data() throws -> Data {
        try JSONSerialization.data(withJSONObject: self)
    }
}

protocol JSONSerializable {
    func jsonObject() throws -> JSON
}

extension Data {
    
    func json() throws -> Any {
        try JSONSerialization.jsonObject(with: self, options: .allowFragments)
    }
}
