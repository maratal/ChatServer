import Foundation

struct AuthController {
    
    func register(_ info: User.Registration) async throws -> User.LoginInfo {
        let registration = try validate(registration: info)
        let user = User(name: registration.name,
                        username: registration.username,
                        passwordHash: registration.password.bcryptHash())
        try await Repositories.users.save(user)
        return try await login(user)
    }
    
    func login(_ user: User) async throws -> User.LoginInfo {
        let token = try user.generateToken()
        try await Repositories.tokens.save(token)
        return .init(info: user.info(), token: token)
    }
    
    func changePassword(_ user: User, oldPassword: String, newPassword: String) async throws {
        guard oldPassword.bcryptHash() == user.passwordHash else {
            throw Errors.invalidPassword
        }
        guard validatePassword(newPassword) else {
            throw Errors.badPassword
        }
        user.passwordHash = newPassword.bcryptHash()
        try await Repositories.users.save(user)
    }
    
    func resetPassword(userId: UserID, newPassword: String, key: String) async throws {
        guard let user = try await Repositories.users.find(id: userId) else {
            throw Errors.invalidUser
        }
        guard key.bcryptHash() == user.keyHash else {
            throw Errors.invalidKey
        }
        guard validatePassword(newPassword) else {
            throw Errors.badPassword
        }
        user.passwordHash = newPassword.bcryptHash()
        try await Repositories.users.save(user)
    }
    
    func changeKey(_ user: User, password: String, newKey: String) async throws {
        guard password.bcryptHash() == user.passwordHash else {
            throw Errors.invalidPassword
        }
        guard validateKey(newKey) else {
            throw Errors.badKey
        }
        user.keyHash = newKey.bcryptHash()
        try await Repositories.users.save(user)
    }
}

extension AuthController {
    
    static var minPasswordLength = 8
    static var minUsernameLength = 5
    static var minKeyLength = 25
    
    struct Errors {
        static var invalidUser     = ServerError(.notFound, reason: "User was not found.")
        static var invalidPassword = ServerError(.badRequest, reason: "Invalid user or password.")
        static var invalidKey      = ServerError(.badRequest, reason: "Invalid restoration key.")
        static var badPassword     = ServerError(.badRequest, reason: "Password should be at least \(minPasswordLength) characters length.")
        static var badKey          = ServerError(.badRequest, reason: "Key should be at least \(minKeyLength) characters length.")
        static var badName         = ServerError(.badRequest, reason: "Name should consist of letters.")
        static var badUsername     = ServerError(.badRequest, reason: "Username should be at least \(minUsernameLength) characters length, start with letter and consist of letters and digits.")
    }
    
    func validatePassword(_ password: String) -> Bool {
        return password.count >= Self.minPasswordLength
    }
    
    func validateKey(_ key: String) -> Bool {
        return key.count >= Self.minKeyLength
    }
    
    func validate(registration info: User.Registration) throws -> User.Registration {
        let registration = User.Registration(name: info.name.normalized(),
                                             username: info.username.normalized().lowercased(),
                                             password: info.password)
        guard registration.name.isName else {
            throw Errors.badName
        }
        guard registration.username.count >= Self.minUsernameLength && registration.username.isAlphanumeric && registration.username.first!.isLetter else {
            throw Errors.badUsername
        }
        guard validatePassword(registration.password) else {
            throw Errors.badPassword
        }
        return registration
    }
}
