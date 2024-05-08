import Vapor

extension String {
    
    func bcryptHash() -> String {
        try! Bcrypt.hash(self)
    }
}

extension Request {
    
    enum Parameter: String {
        case id
        case userId
        case messageId
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
    
    func messageUUID() throws -> UUID {
        guard let uuid = parameters.get(Parameter.messageId.rawValue, as: UUID.self) else {
            throw Abort(.badRequest, reason: "Message UUID was not found in the path.")
        }
        return uuid
    }
    
    func userID() throws -> Int {
        guard let id = parameters.get(Parameter.userId.rawValue, as: Int.self) else {
            throw Abort(.badRequest, reason: "User id was not found in the path.")
        }
        return id
    }
    
    func searchString() throws -> String {
        guard let s: String = query["search"] ?? query["s"] else {
            throw Abort(.badRequest, reason: "Parameter `search` (`s`) was not found in the query.")
        }
        return s.lowercased().trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
    }
    
    func fullInfo() -> Bool {
        guard let full: String = query["full"] else { return false }
        return full == "true" || full == "1"
    }
    
    func date(from param: String) -> Date? {
        if let ts: Double = query[param] {
            return Date(timeIntervalSinceReferenceDate: ts)
        }
        return nil
    }
}

extension PathComponent {
    static var id: Self { ":\(Request.Parameter.id)" }
    static var userId: Self { ":\(Request.Parameter.userId)" }
    static var messageId: Self { ":\(Request.Parameter.messageId)" }
}

extension Request {
    
    func authenticatedUser() throws -> User {
        try auth.require(User.self)
    }
    
#if DEBUG
    func currentUser() async throws -> User {
        if NSClassFromString("XCTest") != nil {
            guard let user = try await Repositories.users.find(id: 1) else {
                throw Abort(.notFound, reason: "Test current user not found.")
            }
            return user
        }
        return try authenticatedUser()
    }
#else
    func currentUser() throws -> User {
        try authenticatedUser()
    }
#endif
}
