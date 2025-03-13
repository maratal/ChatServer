/**
 * This file abstracts pure chat logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol UserServiceProtocol: Sendable {

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
    
    /// Updates current user with the information from the request fields.
    func update(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo
    
    /// Updates current user's device session. The name and the push token of the device can be changed.
    func updateDevice(_ session: DeviceSession, with info: UpdateDeviceSessionRequest) async throws -> User.PrivateInfo
    
    /// Adds photo to the current user.
    func addPhoto(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo
    
    /// Deletes photo from the current user.
    func deletePhoto(_ id: ResourceID, of user: User) async throws
    
    /// Finds user by `id`.
    /// This method works without authentication.
    func find(id: UserID) async throws -> UserInfo
    
    /// Looking for users with a `username` or `name` using the provided string as a substring for those fields.
    /// This method works without authentication.
    func search(_ s: String) async throws -> [UserInfo]
}

actor UserService: UserServiceProtocol {

    private let core: CoreService
    let repo: UsersRepository
    
    init(core: CoreService, repo: UsersRepository) {
        self.core = core
        self.repo = repo
    }
    
    func register(_ request: RegistrationRequest) async throws -> User.PrivateInfo {
        let registration = try validate(registration: request)
        let user = User(name: registration.name,
                        username: registration.username,
                        passwordHash: registration.password.bcryptHash(),
                        accountKeyHash: nil)
        try await repo.save(user)
        return try await login(user, deviceInfo: request.deviceInfo)
    }
    
    func deregister(_ user: User) async throws {
        try await repo.delete(user)
    }
    
    func login(_ user: User, deviceInfo: DeviceInfo) async throws -> User.PrivateInfo {
        let deviceSession = DeviceSession(accessToken: generateAccessToken(),
                                          userID: user.id!,
                                          deviceId: deviceInfo.id,
                                          deviceName: deviceInfo.name,
                                          deviceModel: deviceInfo.model,
                                          deviceToken: deviceInfo.token,
                                          pushTransport: deviceInfo.transport.rawValue)
        try await repo.saveSession(deviceSession)
        try await repo.loadSessions(of: user)
        return user.privateInfo()
    }
    
    func logout(_ user: User) async throws {
        try await repo.deleteSession(of: user)
    }
    
    func current(_ user: User) async throws -> User.PrivateInfo {
        try await repo.loadSessions(of: user)
        return user.privateInfo()
    }
    
    func changePassword(_ user: User, currentPassword: String, newPassword: String) async throws {
        guard try user.verify(password: currentPassword) else {
            throw CoreService.Errors.invalidPassword
        }
        guard validatePassword(newPassword) else {
            throw CoreService.Errors.badPassword
        }
        user.passwordHash = newPassword.bcryptHash()
        try await repo.save(user)
    }
    
    func resetPassword(userId: UserID, newPassword: String, accountKey: String) async throws {
        guard let user = try await repo.find(id: userId) else {
            throw CoreService.Errors.invalidUser
        }
        guard try user.verify(accountKey: accountKey) else {
            throw CoreService.Errors.invalidAccountKey
        }
        guard validatePassword(newPassword) else {
            throw CoreService.Errors.badPassword
        }
        user.passwordHash = newPassword.bcryptHash()
        try await repo.save(user)
    }
    
    func setAccountKey(_ user: User, currentPassword: String, newAccountKey: String) async throws {
        guard try user.verify(password: currentPassword) else {
            throw CoreService.Errors.invalidPassword
        }
        guard validateAccountKey(newAccountKey) else {
            throw CoreService.Errors.badAccountKey
        }
        user.accountKeyHash = newAccountKey.bcryptHash()
        try await repo.save(user)
    }
    
    func update(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo {
        if let name = info.name {
            user.name = name
        }
        if let about = info.about {
            user.about = about
        }
        user.lastAccess = Date()
        try await repo.save(user)
        return user.fullInfo()
    }
    
    func updateDevice(_ session: DeviceSession, with info: UpdateDeviceSessionRequest) async throws -> User.PrivateInfo {
        session.deviceName = info.deviceName
        if let deviceToken = info.deviceToken {
            session.deviceToken = deviceToken
        }
        try await repo.saveSession(session)
        try await repo.loadSessions(of: session.user)
        return session.user.privateInfo()
    }
    
    func addPhoto(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo {
        guard let resource = info.photo, let resourceId = resource.id else {
            throw ServiceError(.badRequest, reason: "Media resource id is missing.")
        }
        guard resource.fileType != "", resource.fileSize > 0 else {
            throw ServiceError(.badRequest, reason: "Media fileType or fileSize are missing.")
        }
        let photo = MediaResource(id: resourceId,
                                  photoOf: user.id!,
                                  fileType: resource.fileType,
                                  fileSize: resource.fileSize,
                                  previewWidth: info.photo?.previewWidth ?? 100,
                                  previewHeight: info.photo?.previewHeight ?? 100)
        try await repo.savePhoto(photo)
        try await repo.reloadPhotos(for: user)
        return user.fullInfo()
    }
    
    func deletePhoto(_ id: ResourceID, of user: User) async throws {
        guard let resource = try await repo.findPhoto(id) else {
            throw ServiceError(.notFound, reason: "Media resource is missing.")
        }
        guard user.id == resource.photoOf?.id else {
            throw ServiceError(.forbidden)
        }
        try core.removeFiles(for: resource)
        try await repo.deletePhoto(resource)
    }
    
    func find(id: UserID) async throws -> UserInfo {
        guard let user = try await repo.find(id: id) else {
            throw ServiceError(.notFound)
        }
        return user.fullInfo()
    }
    
    func search(_ s: String) async throws -> [UserInfo] {
        if let userId = Int(s), userId > 0 {
            return [try await find(id: userId)]
        }
        guard s.count >= 2 else {
            throw ServiceError(.notFound)
        }
        let users = try await repo.search(s)
        return users.map { $0.info() }
    }
}

private extension UserService {
    
    func validatePassword(_ password: String) -> Bool {
        return password.count >= CoreService.Constants.minPasswordLength && password.count <= CoreService.Constants.maxPasswordLength
    }
    
    func validateAccountKey(_ key: String) -> Bool {
        return key.count >= CoreService.Constants.minAccountKeyLength && key.count <= CoreService.Constants.maxAccountKeyLength
    }
    
    func validate(registration: RegistrationRequest) throws -> RegistrationRequest {
        let registration = RegistrationRequest(name: registration.name.normalized(),
                                               username: registration.username.normalized().lowercased(),
                                               password: registration.password,
                                               deviceInfo: registration.deviceInfo)
        guard registration.name.isName else {
            throw CoreService.Errors.badName
        }
        guard registration.username.count >= CoreService.Constants.minUsernameLength &&
              registration.username.count <= CoreService.Constants.maxUsernameLength &&
              registration.username.isAlphanumeric &&
              registration.username.first!.isLetter else {
            throw CoreService.Errors.badUsername
        }
        guard validatePassword(registration.password) else {
            throw CoreService.Errors.badPassword
        }
        return registration
    }
    
    func generateAccessToken() -> String {
        [UInt8].random(count: 32).base64
    }
}
