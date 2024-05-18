import Vapor
import FluentKit

protocol DatabaseRepository {
    var database: Database { get }
    init(database: Database)
}

protocol RepositoryItem: Model { }

final class Repositories {
    
    static var database: Database {
        Application.shared.db
    }
    
    static var users: Users!
    static var chats: Chats!
    static var sessions: DeviceSessions!
    
    static func use(users: Users,
                    sessions: DeviceSessions,
                    chats: Chats
    ) {
        self.users = users
        self.sessions = sessions
        self.chats = chats
    }
    
    static func useDatabase() {
        use(users: UsersDatabaseRepository(database: database),
            sessions: DeviceSessionsDatabaseRepository(database: database),
            chats: ChatsDatabaseRepository(database: database))
    }
    
    static func saveItem(_ item: any RepositoryItem) async throws {
        try await item.save(on: database)
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
