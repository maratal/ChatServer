import Vapor
import FluentKit

protocol DatabaseRepository {
    var database: Database { get }
    init(database: Database)
}

protocol RepositoryItem: Model { }

final class Repositories {
    
    static var database: Database {
        Application.itself.db
    }
    
    static var users: Users!
    static var chats: Chats!
    static var tokens: UserTokens!
    
    static func use(users: Users,
                    tokens: UserTokens,
                    chats: Chats
    ) {
        self.users = users
        self.tokens = tokens
        self.chats = chats
    }
    
    static func useDatabase() {
        use(users: UsersDatabaseRepository(database: database),
            tokens: UserTokensDatabaseRepository(database: database),
            chats: ChatsDatabaseRepository(database: database))
    }
    
    static func saveAll(_ items: [any RepositoryItem]) async throws {
        try await withThrowingTaskGroup(of: Void.self) { group in
            for item in items {
                group.addTask {
                    try await item.save(on: database)
                }
            }
            try await group.waitForAll()
        }
    }
}
