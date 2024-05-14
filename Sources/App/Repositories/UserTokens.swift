import FluentKit

protocol UserTokens {
    func save(_ token: UserToken) async throws
    func delete(user: User) async throws
}

struct UserTokensDatabaseRepository: UserTokens, DatabaseRepository {
    var database: Database
    
    func save(_ token: UserToken) async throws {
        try await token.save(on: database)
    }
    
    func delete(user: User) async throws {
        guard let userId = user.id else { return }
        try await UserToken.query(on: database)
            .filter(\.$user.$id == userId)
            .delete()
    }
}
