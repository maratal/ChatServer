import Vapor

extension UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.group(Request.Parameter.id.pathComponent) { route in
            route.get(use: user)
        }
        
        let protected = users.grouped(UserToken.authenticator())
        protected.get(use: search)
    }
    
    func update(_ req: Request) async throws -> HTTPStatus {
        let userInfo = try req.content.decode(UserInfo.self)
        try await update(req.currentUser(), with: userInfo)
        return .ok
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        try await find(id: req.objectID()).fullInfo()
    }
    
    func search(_ req: Request) async throws -> [UserInfo] {
        try await search(req.searchString()).map { $0.info() }
    }
    
    func contacts(_ req: Request) async throws -> [ContactInfo] {
        let contacts = try await contacts(of: req.currentUser())
        return contacts.map { $0.info() }
    }
    
    func addContact(_ req: Request) async throws -> ContactInfo {
        let contactInfo = try req.content.decode(ContactInfo.self)
        let contact = try await addContact(contactInfo, to: req.currentUser())
        return contact.info()
    }
    
    func deleteContact(_ req: Request) async throws -> HTTPStatus {
        try await deleteContact(try req.objectUUID(), from: req.currentUser())
        return .ok
    }
}
