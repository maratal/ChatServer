/**
 * This file abstracts pure chat logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol ContactsServiceProtocol: LoggedIn {

    /// Returns all contacts for the current user.
    func contacts(of user: User) async throws -> [ContactInfo]
    
    /// Adds a user as a contact of the current user.
    func addContact(_ info: ContactInfo, to user: User) async throws -> ContactInfo
    
    /// Deletes the contact of the current user.
    func deleteContact(_ contactId: ContactID, from user: User) async throws
}

actor ContactsService: ContactsServiceProtocol {
    
    let repo: ContactsRepository
    var currentUser: User?
    
    init(repo: ContactsRepository) {
        self.repo = repo
    }
    
    func with(_ currentUser: User?) -> ContactsService {
        self.currentUser = currentUser
        return self
    }
    
    func contacts(of user: User) async throws -> [ContactInfo] {
        try await repo.contacts(of: user).map { $0.info() }
    }
    
    func addContact(_ info: ContactInfo, to user: User) async throws -> ContactInfo {
        guard let contactUserId = info.user.id else {
            throw ServiceError(.badRequest, reason: "User should have an id.")
        }
        if let contact = try await repo.findContact(userId: contactUserId, ownerId: user.id!) {
            return contact.info()
        }
        let contact = Contact(ownerId: user.id!, userId: contactUserId, isFavorite: info.isFavorite, name: info.name)
        try await repo.saveContact(contact)
        // Copy old object to avoid re-fetching data from database
        return ContactInfo(from: info, id: contact.id!)
    }
    
    func deleteContact(_ contactId: ContactID, from user: User) async throws {
        guard let contact = try await repo.findContact(contactId), contact.$owner.id == user.id else {
            throw ServiceError(.notFound, reason: "Contact not found.")
        }
        try await repo.deleteContact(contact)
    }
}
