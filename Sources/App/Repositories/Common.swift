import Vapor
import FluentKit

protocol DatabaseRepository {
    var database: Database { get }
    init(database: Database)
}

final class Repositories {
    
    static var database: Database {
        Application.itself.db
    }
    
    static var users: Users!
    static var tokens: UserTokens!
    
    static func use(users: Users,
                    tokens: UserTokens) {
        self.users = users
        self.tokens = tokens
    }
    
    static func useDatabase() {
        use(users: UsersDatabaseRepository(database: database),
            tokens: UserTokensDatabaseRepository(database: database))
    }
}
