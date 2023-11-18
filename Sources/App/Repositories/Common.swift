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
    
    static func use(users: Users) {
        self.users = users
    }
    
    static func useDatabase() {
        use(users: UsersDatabaseRepository(database: database))
    }
}
