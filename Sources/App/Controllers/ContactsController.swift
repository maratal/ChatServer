/**
 * This controller object just redirects everything to the appropriate service actor. Do not add any logic here.
 */
import Vapor

struct ContactsController: RouteCollection {

    let service: ContactsServiceProtocol
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        let protected = users.grouped(DeviceSession.authenticator())
        
        protected.group("me") { route in
            route.get("contacts", use: contacts)
            route.post("contacts", use: addContact)
            route.delete("contacts", .id, use: deleteContact)
        }
    }
    
    func contacts(_ req: Request) async throws -> [ContactInfo] {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).contacts(of: currentUser)
    }
    
    func addContact(_ req: Request) async throws -> ContactInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).addContact(req.content.decode(ContactInfo.self), to: currentUser)
    }
    
    func deleteContact(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).deleteContact(try req.objectUUID(), from: currentUser)
        return .ok
    }
}
