import Foundation

struct UserController {
    
    func find(id: UserID) async throws -> User {
        guard let user = try? await Repositories.users.find(id: id) else {
            throw ServerError(.notFound)
        }
        return user
    }
    
    func search(_ s: String) async throws -> [User] {
        if let userID = Int(s), userID > 0 {
            return [try await find(id: userID)]
        }
        let users = try await Repositories.users.search(s)
        return users
    }
    
    func contacts(of user: User) async throws -> [Contact] {
        let contacts = try await Repositories.users.contacts(of: user)
        return contacts
    }
    
    func addContact(_ info: ContactInfo, to user: User) async throws -> Contact {
        guard let contactUserId = info.user.id else {
            throw ServerError(.badRequest, reason: "User should have an id.")
        }
        if let contact = try await Repositories.users.findContact(userId: contactUserId, ownerId: user.requireID()) {
            return contact
        }
        let contact = Contact(name: info.name, ownerId: try user.requireID(), userId: contactUserId)
        try await Repositories.users.saveContact(contact)
        return contact
    }
    
    func deleteContact(_ contactId: UUID, from user: User) async throws {
        guard let contact = try await Repositories.users.findContact(contactId), contact.owner.id == user.id else {
            throw ServerError(.notFound, reason: "Contact not found.")
        }
        try await Repositories.users.deleteContact(contact)
    }
}
