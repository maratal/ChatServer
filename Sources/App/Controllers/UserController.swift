import Foundation

struct UserController {
    
    func user(_ userID: Int) async throws -> UserInfo {
        guard let user = try? await Repositories.users.find(id: userID) else {
            throw ServerError(.notFound)
        }
        return user.info()
    }
    
    func search(_ s: String) async throws -> [UserInfo] {
        if let userID = Int(s), userID > 0 {
            return [try await user(userID)]
        }
        let users = try await Repositories.users.search(s)
        return users.map { $0.info() }
    }
}
