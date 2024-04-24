import FluentKit

protocol Users {
    func fetch(id: Int) async throws -> User
    func find(id: Int) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ user: User) async throws
    func search(_ s: String) async throws -> [User]
    
    func findContact(_ id: UUID) async throws -> Contact?
    func findContact(userId: UserID, ownerId: UserID) async throws -> Contact?
    func contacts(of user: User) async throws -> [Contact]
    func saveContact(_ contact: Contact) async throws
    func deleteContact(_ contact: Contact) async throws
}

struct UsersDatabaseRepository: Users, DatabaseRepository {
    var database: Database

    func fetch(id: UserID) async throws -> User {
        try await User.find(id, on: database).get()!
    }
    
    func find(id: UserID) async throws -> User? {
        try await User.find(id, on: database).get()
    }
    
    func save(_ user: User) async throws {
        try await user.save(on: database)
    }
    
    func delete(_ user: User) async throws {
        try await user.delete(on: database)
    }
    
    func search(_ s: String) async throws -> [User] {
        try await User.query(on: database).group(.or) { query in
            query.filter(\.$name ~~ s)
            query.filter(\.$username ~~ s)
        }.range(..<100).all()
    }
    
    func findContact(_ id: UUID) async throws -> Contact? {
        try await Contact.find(id, on: database)
    }
    
    func findContact(userId: UserID, ownerId: UserID) async throws -> Contact? {
        try await Contact.query(on: database).group(.and) { query in
            query.filter(\.user.$id == userId)
            query.filter(\.owner.$id == ownerId)
        }.first()
    }
    
    func contacts(of user: User) async throws -> [Contact] {
        try await user.$contacts.get(on: database)
    }
    
    func saveContact(_ contact: Contact) async throws {
        try await contact.save(on: database)
    }
    
    func deleteContact(_ contact: Contact) async throws {
        try await contact.delete(on: database)
    }
}
