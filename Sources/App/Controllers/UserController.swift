import Foundation

struct UserController {
    
    func create(_ user: User) async throws {
        try await Repositories.users.save(user)
    }
    
    func delete(_ userID: Int) async throws {
        let user = try await find(userID)
        try await Repositories.users.delete(user)
    }
    
    func find(_ userID: Int) async throws -> User {
        guard let user = try? await Repositories.users.find(id: userID) else {
            throw ServerError(.notFound)
        }
        return user
    }
    
    func search(_ s: String) async throws -> [User] {
        if let userID = Int(s) {
            return [try await find(userID)]
        }
        let users = try await Repositories.users.search(s)
        return users
    }
}
