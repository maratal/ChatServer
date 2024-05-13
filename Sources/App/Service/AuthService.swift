import Foundation

protocol AuthService {
    
    /// Registers a new user account and authenticates it.
    func register(_ request: RegistrationRequest) async throws -> LoginResponse
    
    /// Authenticates user by checking username-password pair and generating an access token.
    func login(_ user: User) async throws -> LoginResponse
    
    /// Changes password by providing user's current password..
    func changePassword(_ user: User, currentPassword: String, newPassword: String) async throws
    
    /// Resets password by checking the account key.
    /// Empty account key acts as an invalid key and user is not able to restore their account.
    func resetPassword(userId: UserID, newPassword: String, accountKey: String) async throws
    
    /// Sets an account key by providing user's current password.
    func setAccountKey(_ user: User, currentPassword: String, newAccountKey: String) async throws
}

extension AuthService {
    
    func register(_ request: RegistrationRequest) async throws -> LoginResponse {
        let registration = try validate(registration: request)
        let user = User(name: registration.name,
                        username: registration.username,
                        passwordHash: registration.password.bcryptHash(),
                        accountKeyHash: nil)
        try await Repositories.users.save(user)
        return try await login(user)
    }
    
    func login(_ user: User) async throws -> LoginResponse {
        let token = try user.generateToken()
        try await Repositories.tokens.save(token)
        return .init(info: user.fullInfo(), token: token.value)
    }
    
    func changePassword(_ user: User, currentPassword: String, newPassword: String) async throws {
        guard try user.verify(password: currentPassword) else {
            throw Service.Errors.invalidPassword
        }
        guard validatePassword(newPassword) else {
            throw Service.Errors.badPassword
        }
        user.passwordHash = newPassword.bcryptHash()
        try await Repositories.users.save(user)
    }
    
    func resetPassword(userId: UserID, newPassword: String, accountKey: String) async throws {
        guard let user = try await Repositories.users.find(id: userId) else {
            throw Service.Errors.invalidUser
        }
        guard try user.verify(accountKey: accountKey) else {
            throw Service.Errors.invalidAccountKey
        }
        guard validatePassword(newPassword) else {
            throw Service.Errors.badPassword
        }
        user.passwordHash = newPassword.bcryptHash()
        try await Repositories.users.save(user)
    }
    
    func setAccountKey(_ user: User, currentPassword: String, newAccountKey: String) async throws {
        guard try user.verify(password: currentPassword) else {
            throw Service.Errors.invalidPassword
        }
        guard validateAccountKey(newAccountKey) else {
            throw Service.Errors.badAccountKey
        }
        user.accountKeyHash = newAccountKey.bcryptHash()
        try await Repositories.users.save(user)
    }
}

private extension AuthService {
    
    func validatePassword(_ password: String) -> Bool {
        return password.count >= Service.Constants.minPasswordLength && password.count <= Service.Constants.maxPasswordLength
    }
    
    func validateAccountKey(_ key: String) -> Bool {
        return key.count >= Service.Constants.minAccountKeyLength && key.count <= Service.Constants.maxAccountKeyLength
    }
    
    func validate(registration: RegistrationRequest) throws -> RegistrationRequest {
        let registration = RegistrationRequest(name: registration.name.normalized(),
                                               username: registration.username.normalized().lowercased(),
                                               password: registration.password)
        guard registration.name.isName else {
            throw Service.Errors.badName
        }
        guard registration.username.count >= Service.Constants.minUsernameLength &&
              registration.username.count <= Service.Constants.maxUsernameLength &&
              registration.username.isAlphanumeric &&
              registration.username.first!.isLetter else {
            throw Service.Errors.badUsername
        }
        guard validatePassword(registration.password) else {
            throw Service.Errors.badPassword
        }
        return registration
    }
}
