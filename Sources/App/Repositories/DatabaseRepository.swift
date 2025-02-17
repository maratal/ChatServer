import FluentKit

protocol DatabaseRepository {
    var database: Database { get }
}

protocol RepositoryItem: Model { }
