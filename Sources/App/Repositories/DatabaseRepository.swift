import FluentKit

protocol DatabaseRepositoryProtocol {
    var database: Database { get }
    init(database: Database)
}

class DatabaseRepository: DatabaseRepositoryProtocol {
    var database: Database
    required init(database: Database) {
        self.database = database
    }
}

protocol RepositoryItem: Model { }
