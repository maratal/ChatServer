import FluentKit

protocol UserTokens {
    func save(_ token: UserToken) async throws
}

struct UserTokensDatabaseRepository: UserTokens, DatabaseRepository {
    var database: Database
    
    func save(_ token: UserToken) async throws {
        try await token.save(on: database)
    }
}
