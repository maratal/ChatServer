import FluentKit

protocol Users {
    func find(id: Int) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ user: User) async throws
    func search(_ s: String) async throws -> [User]
}

struct UsersDatabaseRepository: Users, DatabaseRepository {
    var database: Database

    func find(id: Int) async throws -> User? {
        try await User.find(id, on: database).get()
    }
    
    func save(_ user: User) async throws {
        try await user.save(on: database)
    }
    
    func delete(_ user: User) async throws {
        try await user.delete(on: database)
    }
    
    func search(_ s: String) async throws -> [User] {
        try await User.query(on: database).all()
    }
}
