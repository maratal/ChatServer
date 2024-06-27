import Foundation

protocol UserServiceProtocol {
    
    /// Repository for storing and fetching users data.
    var repo: UsersRepository { get }
    
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
    
    /// Creates web socket for user and updates his device information.
    func online(_ session: DeviceSession, deviceInfo: DeviceInfo) async throws -> User.PrivateInfo
    
    /// Updates current user with the information from the request fields.
    func update(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo
    
    /// Adds photo to the current user.
    func addPhoto(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo
    
    /// Deletes photo from the current user.
    func deletePhoto(_ id: UUID, of user: User) async throws
    
    /// Finds user by `id`.
    /// This method works without authentication.
    func find(id: UserID) async throws -> UserInfo
    
    /// Looking for users with a `username` or `name` using the provided string as a substring for those fields.
    /// This method works without authentication.
    func search(_ s: String) async throws -> [UserInfo]
}

final class UserService: UserServiceProtocol {
    
    var repo: UsersRepository
    
    init(repo: UsersRepository) {
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
        _ = try await repo.allSessions(of: user)
        return user.privateInfo()
    }
    
    func logout(_ user: User) async throws {
        try await repo.deleteSession(of: user)
    }
    
    func current(_ user: User) async throws -> User.PrivateInfo {
        _ = try await repo.allSessions(of: user)
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
        try await repo.save(user)
    }
    
    func resetPassword(userId: UserID, newPassword: String, accountKey: String) async throws {
        guard let user = try await repo.find(id: userId) else {
            throw Service.Errors.invalidUser
        }
        guard try user.verify(accountKey: accountKey) else {
            throw Service.Errors.invalidAccountKey
        }
        guard validatePassword(newPassword) else {
            throw Service.Errors.badPassword
        }
        user.passwordHash = newPassword.bcryptHash()
        try await repo.save(user)
    }
    
    func setAccountKey(_ user: User, currentPassword: String, newAccountKey: String) async throws {
        guard try user.verify(password: currentPassword) else {
            throw Service.Errors.invalidPassword
        }
        guard validateAccountKey(newAccountKey) else {
            throw Service.Errors.badAccountKey
        }
        user.accountKeyHash = newAccountKey.bcryptHash()
        try await repo.save(user)
    }
    
    func online(_ session: DeviceSession, deviceInfo: DeviceInfo) async throws -> User.PrivateInfo {
        guard session.deviceId == deviceInfo.id, session.deviceModel == deviceInfo.model else {
            throw ServiceError(.badRequest, reason: "You can only change device's name and token.")
        }
        session.deviceName = deviceInfo.name
        session.deviceToken = deviceInfo.token
        let user = session.user
        user.lastAccess = Date()
        try await Service.saveAll([session, user])
        try Service.listener.listenForDeviceWithSession(session)
        _ = try await repo.allSessions(of: user)
        return user.privateInfo()
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
    
    func deletePhoto(_ id: UUID, of user: User) async throws {
        guard let resource = try await repo.findPhoto(id) else {
            throw ServiceError(.notFound, reason: "Media resource is missing.")
        }
        guard user.id == resource.photoOf?.id else {
            throw ServiceError(.forbidden)
        }
        try resource.removeFiles()
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
