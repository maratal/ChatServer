import FluentKit

protocol UsersRepository {
    func fetch(id: UserID) async throws -> User
    func find(id: UserID) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ user: User) async throws
    func search(_ s: String) async throws -> [User]
    
    func saveSession(_ session: DeviceSession) async throws
    func deleteSession(of user: User) async throws
    func allSessions(of user: User) async throws -> [DeviceSession]
}

final class UsersDatabaseRepository: DatabaseRepository, UsersRepository {

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
    
    func saveSession(_ session: DeviceSession) async throws {
        try await session.save(on: database)
    }
    
    func deleteSession(of user: User) async throws {
        guard let userId = user.id else { return }
        try await DeviceSession.query(on: database)
            .filter(\.$user.$id == userId)
            .delete()
    }
    
    func allSessions(of user: User) async throws -> [DeviceSession] {
        return try await user.$deviceSessions.get(on: database)
    }
}
