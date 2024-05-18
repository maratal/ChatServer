import FluentKit

protocol DeviceSessions {
    func save(_ token: DeviceSession) async throws
    func delete(user: User) async throws
    func allForUser(_ user: User) async throws -> [DeviceSession]
}

struct DeviceSessionsDatabaseRepository: DeviceSessions, DatabaseRepository {
    var database: Database
    
    func save(_ token: DeviceSession) async throws {
        try await token.save(on: database)
    }
    
    func delete(user: User) async throws {
        guard let userId = user.id else { return }
        try await DeviceSession.query(on: database)
            .filter(\.$user.$id == userId)
            .delete()
    }
    
    func allForUser(_ user: User) async throws -> [DeviceSession] {
        return try await user.$deviceSessions.get(on: database)
    }
}
