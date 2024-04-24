import Vapor

extension UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.group(Request.Parameter.id.pathComponent) { route in
            route.get(use: user)
        }
        
        let protected = users.grouped(UserToken.authenticator())
        protected.group("me") { route in
            route.put(use: update)
            route.get("contacts", use: contacts)
            route.post("contacts", use: addContact)
            route.delete("contacts", Request.Parameter.id.pathComponent, use: deleteContact)
        }
        protected.group("current") { route in
            route.get(use: current)
            route.put(use: update)
            route.get("contacts", use: contacts)
            route.post("contacts", use: addContact)
            route.delete("contacts", Request.Parameter.id.pathComponent, use: deleteContact)
        }
        protected.get(use: search)
    }
    
    // In test environment returns not real user for tests purposes only. In production is the same as `me`.
    func current(_ req: Request) async throws -> UserInfo {
        try await req.currentUser().fullInfo()
    }
    
    func update(_ req: Request) async throws -> UserInfo {
        let info = try req.content.decode(UserInfo.self)
        return try await update(req.currentUser(), with: info)
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        try await find(id: req.objectID()).fullInfo()
    }
    
    func search(_ req: Request) async throws -> [UserInfo] {
        try await search(req.searchString())
    }
    
    func contacts(_ req: Request) async throws -> [ContactInfo] {
        try await contacts(of: req.currentUser())
    }
    
    func addContact(_ req: Request) async throws -> ContactInfo {
        let contactInfo = try req.content.decode(ContactInfo.self)
        return try await addContact(contactInfo, to: req.currentUser())
    }
    
    func deleteContact(_ req: Request) async throws -> HTTPStatus {
        try await deleteContact(try req.objectUUID(), from: req.currentUser())
        return .ok
    }
}
