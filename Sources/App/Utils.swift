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
    
    func bcryptHash() -> String {
        try! Bcrypt.hash(self)
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
            throw Abort(.badRequest, reason: "Integer id was not found in the path.")
        }
        return id
    }
    
    func objectUUID() throws -> UUID {
        guard let uuid = parameters.get(Parameter.id.rawValue, as: UUID.self) else {
            throw Abort(.badRequest, reason: "UUID id was not found in the path.")
        }
        return uuid
    }
    
    func searchString() throws -> String {
        guard let s: String = query["search"] ?? query["s"] else {
            throw Abort(.badRequest, reason: "Parameter `search` (`s`) was not found in the query.")
        }
        return s.lowercased().trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
    }
}

extension Request {
    
    func authenticatedUser() throws -> User {
        try auth.require(User.self)
    }
    
#if DEBUG
    static func testUser() async throws -> User {
        let user = User(name: "Test", username: "test", passwordHash: "")
        try await Repositories.users.save(user)
        return user
    }
    
    func currentUser() async throws -> User {
        if NSClassFromString("XCTest") != nil {
            return try await Self.testUser()
        }
        return try authenticatedUser()
    }
#else
    func currentUser() throws -> User {
        try authenticatedUser()
    }
#endif
}
