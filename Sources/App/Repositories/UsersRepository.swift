import FluentKit
import Foundation

protocol UsersRepository: Sendable {
    func fetch(id: UserID) async throws -> User
    func find(id: UserID) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ user: User) async throws
    func all(before userID: UserID?, count: Int) async throws -> [User]
    func search(_ s: String) async throws -> [User]
    
    func findPhoto(_ id: ResourceID) async throws -> MediaResource?
    func savePhoto(_ photo: MediaResource) async throws
    func deletePhoto(_ photo: MediaResource) async throws
    func reloadPhotos(of user: User) async throws
    
    func saveSession(_ session: DeviceSession) async throws
    func deleteSession(of user: User) async throws
    
    @discardableResult
    func loadSessions(of user: User) async throws -> [DeviceSession]
}

actor UsersDatabaseRepository: DatabaseRepository, UsersRepository {
    
    let database: any Database
    
    init(database: any Database) {
        self.database = database
    }
    
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
    
    func all(before userID: UserID?, count: Int) async throws -> [User] {
        var query = User.query(on: database)
        
        // If userID is provided, get users with ID less than it (for cursor pagination)
        if let userID = userID {
            query = query.filter(\.$id < userID)
        }
        
        // Sort by ID descending to get latest users first
        return try await query
            .sort(\.$id, .descending)
            .range(..<count)
            .with(\.$photos)
            .all()
    }
    
    func search(_ s: String) async throws -> [User] {
        try await User.query(on: database).group(.or) { query in
            query.filter(\.$name, .custom("ILIKE"), "%\(s)%")
            query.filter(\.$username, .custom("ILIKE"), "%\(s)%")
        }
        .range(..<100)
        .with(\.$photos)
        .all()
    }
    
    func findPhoto(_ id: ResourceID) async throws -> MediaResource? {
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
    
    func reloadPhotos(of user: User) async throws {
        let photos = try await MediaResource.query(on: database)
            .filter(\.$photoOf.$id == user.id)
            .sort(\.$uploadedAt, .ascending)
            .all()
        user.$photos.value = photos
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
    
    @discardableResult
    func loadSessions(of user: User) async throws -> [DeviceSession] {
        try await user.$deviceSessions.get(on: database)
    }
}
