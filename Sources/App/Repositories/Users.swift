import FluentKit

protocol Users {
    func find(id: Int) async throws -> User?
}

struct UsersDatabaseRepository: Users, DatabaseRepository {
    var database: Database
    
    func find(id: Int) async throws -> User? {
        try await User.find(id, on: database).get()
    }
}
