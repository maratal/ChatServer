import Vapor

struct UserController: UserService, RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.group(.id) { route in
            route.get(use: user)
        }
        
        let protected = users.grouped(DeviceSession.authenticator())
        protected.group("me") { route in
            route.put(use: update)
            route.get("contacts", use: contacts)
            route.post("contacts", use: addContact)
            route.delete("contacts", .id, use: deleteContact)
        }
        protected.group("current") { route in
            route.get(use: current)
            route.put(use: update)
            route.get("contacts", use: contacts)
            route.post("contacts", use: addContact)
            route.delete("contacts", .id, use: deleteContact)
        }
        protected.get(use: search)
    }
    
    func online(_ req: Request) async throws -> User.PrivateInfo {
        let deviceInfo = try req.content.decode(DeviceInfo.self)
        return try await online(req.deviceSession(), deviceInfo: deviceInfo)
    }
    
    // In test environment returns user with id = 1. In production returns authenticated user (same as `me`).
    func current(_ req: Request) async throws -> User.PrivateInfo {
        try await current(req.currentUser())
    }
    
    func update(_ req: Request) async throws -> UserInfo {
        try await update(req.currentUser(), with: req.content.decode(UpdateUserRequest.self))
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        try await find(id: req.objectID())
    }
    
    func search(_ req: Request) async throws -> [UserInfo] {
        try await search(req.searchString())
    }
    
    func contacts(_ req: Request) async throws -> [ContactInfo] {
        try await contacts(of: req.currentUser())
    }
    
    func addContact(_ req: Request) async throws -> ContactInfo {
        try await addContact(req.content.decode(ContactInfo.self), to: req.currentUser())
    }
    
    func deleteContact(_ req: Request) async throws -> HTTPStatus {
        try await deleteContact(try req.objectUUID(), from: req.currentUser())
        return .ok
    }
}
