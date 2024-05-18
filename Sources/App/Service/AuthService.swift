import Foundation

protocol AuthService {
    
    /// Registers a new user account and authenticates it.
    func register(_ request: RegistrationRequest) async throws -> User.PrivateInfo
    
    /// Deregisters user's account and deletes all associated data.
    func deregister(_ user: User) async throws
    
    /// Authenticates user by checking username-password pair and generating an access token.
    /// In Vapor it happens semi-automatically (see `ModelAuthenticatable`), so this method only generates a token.
    func login(_ user: User, deviceInfo: DeviceInfo) async throws -> User.PrivateInfo
    
    /// Resets user's current authentication (in Vapor) and token to `nil`.
    func logout(_ user: User) async throws
    
    /// Returns full information about current user including all logged in sessions.
    func current(_ user: User) async throws -> User.PrivateInfo
    
    /// Changes password by providing user's current password..
    func changePassword(_ user: User, currentPassword: String, newPassword: String) async throws
    
    /// Resets password by checking the account key.
    /// Empty account key acts as an invalid key and user is not able to restore their account.
    func resetPassword(userId: UserID, newPassword: String, accountKey: String) async throws
    
    /// Sets an account key by providing user's current password.
    func setAccountKey(_ user: User, currentPassword: String, newAccountKey: String) async throws
}

extension AuthService {
    
    func register(_ request: RegistrationRequest) async throws -> User.PrivateInfo {
        let registration = try validate(registration: request)
        let user = User(name: registration.name,
                        username: registration.username,
                        passwordHash: registration.password.bcryptHash(),
                        accountKeyHash: nil)
        try await Repositories.users.save(user)
        return try await login(user, deviceInfo: request.deviceInfo)
    }
    
    func deregister(_ user: User) async throws {
        try await Repositories.users.delete(user)
    }
    
    func logout(_ user: User) async throws {
        try await Repositories.sessions.delete(user: user)
    }
    
    func current(_ user: User) async throws -> User.PrivateInfo {
        _ = try await Repositories.sessions.allForUser(user)
        return user.privateInfo()
    }
    
    func login(_ user: User, deviceInfo: DeviceInfo) async throws -> User.PrivateInfo {
        let deviceSession = DeviceSession(accessToken: generateAccessToken(),
                                          userID: user.id!,
                                          deviceId: deviceInfo.id,
                                          deviceName: deviceInfo.name,
                                          deviceModel: deviceInfo.model,
                                          deviceToken: deviceInfo.token,
                                          pushTransport: deviceInfo.transport.rawValue)
        try await Repositories.sessions.save(deviceSession)
        _ = try await Repositories.sessions.allForUser(user)
        return user.privateInfo()
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
                                               password: registration.password,
                                               deviceInfo: registration.deviceInfo)
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
    
    func generateAccessToken() -> String {
        [UInt8].random(count: 32).base64
    }
}
