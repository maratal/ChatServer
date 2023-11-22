import Foundation

struct UserController {
    
    func register(_ info: User.Registration) async throws -> User.LoginInfo {
        let registration = try validate(registration: info)
        let user = User(name: registration.name,
                        username: registration.username,
                        passwordHash: registration.password.bcryptBase64String())
        try await Repositories.users.save(user)
        let token = try await login(user)
        return .init(info: try UserInfo(from: user), token: token)
    }
    
    func login(_ user: User) async throws -> UserToken {
        let token = try user.generateToken()
        try await Repositories.tokens.save(token)
        return token
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

extension UserController {
    
    func validate(registration info: User.Registration) throws -> User.Registration {
        let registration = User.Registration(name: info.name.normalized(),
                                             username: info.username.normalized().lowercased(),
                                             password: info.password)
        guard registration.name.isName else {
            throw ServerError(.badRequest, reason: "Name should consist of letters.")
        }
        guard registration.username.count >= 6 && registration.username.isAlphanumeric && registration.username.first!.isLetter else {
            throw ServerError(.badRequest, reason: "Username should be at least 6 characters length, start with letter and consist of letters and digits.")
        }
        guard registration.password.count >= 8 else { throw ServerError(.badRequest, reason: "Password should be at least 8 characters length.") }
        return registration
    }
}
