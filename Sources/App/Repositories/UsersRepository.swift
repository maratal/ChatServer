import FluentKit

protocol UsersRepository {
    func fetch(id: UserID) async throws -> User
    func find(id: UserID) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ user: User) async throws
    func search(_ s: String) async throws -> [User]
    
    func findPhoto(_ id: UUID) async throws -> MediaResource?
    func savePhoto(_ photo: MediaResource) async throws
    func deletePhoto(_ photo: MediaResource) async throws
    func reloadPhotos(for user: User) async throws
    
    func saveSession(_ session: DeviceSession) async throws
    func deleteSession(of user: User) async throws
    func allSessions(of user: User) async throws -> [DeviceSession]
}

final class UsersDatabaseRepository: DatabaseRepository, UsersRepository {

    func fetch(id: UserID) async throws -> User {
        try await find(id: id)!
    }
    
    func find(id: UserID) async throws -> User? {
        try await User.query(on: database)
            .filter(\.$id == id)
            .with(\.$photos)
            .first()
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
        }
        .range(..<100)
        .with(\.$photos)
        .all()
    }
    
    func findPhoto(_ id: UUID) async throws -> MediaResource? {
        try await MediaResource.query(on: database)
            .filter(\.$id == id)
            .with(\.$photoOf)
            .first()
    }
    
    func savePhoto(_ photo: MediaResource) async throws {
        try await photo.save(on: database)
    }
    
    func deletePhoto(_ photo: MediaResource) async throws {
        try await photo.delete(on: database)
    }
    
    func reloadPhotos(for user: User) async throws {
        _ = try await user.$photos.get(reload: true, on: database)
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
        try await user.$deviceSessions.get(on: database)
    }
}
