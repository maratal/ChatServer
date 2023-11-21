import Foundation

struct UserController {
    
    func all() async throws -> [User] {
        try await Repositories.users.all()
    }
    
    func create(_ user: User) async throws -> User {
        try await Repositories.users.save(user)
        return user
    }
    
    func delete(_ userID: Int) async throws {
        guard let user = try? await Repositories.users.find(id: userID) else {
            throw ServerError(.notFound)
        }
        try await Repositories.users.delete(user)
    }
}
