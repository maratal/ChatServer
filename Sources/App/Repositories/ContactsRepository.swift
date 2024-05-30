import FluentKit

protocol ContactsRepository {
    func findContact(_ id: UUID) async throws -> Contact?
    func findContact(userId: UserID, ownerId: UserID) async throws -> Contact?
    func contacts(of user: User) async throws -> [Contact]
    func saveContact(_ contact: Contact) async throws
    func deleteContact(_ contact: Contact) async throws
}

final class ContactsDatabaseRepository: DatabaseRepository, ContactsRepository {
    
    func findContact(_ id: UUID) async throws -> Contact? {
        try await Contact.find(id, on: database)
    }
    
    func findContact(userId: UserID, ownerId: UserID) async throws -> Contact? {
        try await Contact.query(on: database).group(.and) { query in
            query.filter(\.$user.$id == userId)
            query.filter(\.$owner.$id == ownerId)
        }.first()
    }
    
    func contacts(of user: User) async throws -> [Contact] {
        try await Contact.query(on: database)
            .with(\.$user)
            .filter(\.$owner.$id == user.requireID())
            .all()
    }
    
    func saveContact(_ contact: Contact) async throws {
        try await contact.save(on: database)
    }
    
    func deleteContact(_ contact: Contact) async throws {
        try await contact.delete(on: database)
    }
}
