/**
 * This controller object just redirects everything to the appropriate service actor. Do not add any logic here.
 */
import Vapor

struct ContactsController: RouteCollection {

    let service: ContactsService
    
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
        try await service.contacts(of: req.currentUser())
    }
    
    func addContact(_ req: Request) async throws -> ContactInfo {
        try await service.addContact(req.content.decode(ContactInfo.self), to: req.currentUser())
    }
    
    func deleteContact(_ req: Request) async throws -> HTTPStatus {
        try await service.deleteContact(try req.objectUUID(), from: req.currentUser())
        return .ok
    }
}
