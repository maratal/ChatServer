import Foundation

struct AuthController {
    
    func register(_ info: User.Registration) async throws -> User.LoginInfo {
        let registration = try validate(registration: info)
        let user = User(name: registration.name,
                        username: registration.username,
                        passwordHash: try registration.password.bcryptHash())
        try await Repositories.users.save(user)
        return try await login(user)
    }
    
    func login(_ user: User) async throws -> User.LoginInfo {
        let token = try user.generateToken()
        try await Repositories.tokens.save(token)
        return .init(info: user.info(), token: token)
    }
}

extension AuthController {
    
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
