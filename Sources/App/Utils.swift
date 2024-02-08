import Vapor

extension String {
    
    var isAlphanumeric: Bool {
        let notAlphanumeric = CharacterSet.decimalDigits.union(CharacterSet.letters).inverted
        return rangeOfCharacter(from: notAlphanumeric, options: String.CompareOptions.literal, range: nil) == nil
    }
    
    func normalized() -> String {
        trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
    }
    
    var isName: Bool {
        !isEmpty && normalized().replacingOccurrences(of: " ", with: "").isAlphanumeric
    }
    
    func bcryptHash() throws -> String {
        try Bcrypt.hash(self)
    }
}

extension Request {
    
    enum Parameter: String {
        case id
        
        var pathComponent: PathComponent {
            ":\(self)"
        }
    }
    
    func objectID() throws -> Int {
        guard let id = parameters.get(Parameter.id.rawValue, as: Int.self) else {
            throw Abort(.badRequest)
        }
        return id
    }
    
    func objectUUID() throws -> UUID {
        guard let uuid = parameters.get(Parameter.id.rawValue, as: UUID.self) else {
            throw Abort(.badRequest)
        }
        return uuid
    }
    
    func searchString() throws -> String {
        guard let s: String = query["s"] else {
            throw Abort(.badRequest)
        }
        return s.lowercased().trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
    }
}

extension Request {
    
    func currentUser() throws -> User {
        try auth.require(User.self)
    }
}
