/**
 * This file abstracts pure chat logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol UserServiceProtocol: LoggedIn {

    /// Registers a new user account and authenticates it.
    func register(_ request: RegistrationRequest, ipAddress: String?) async throws -> User.PrivateInfo
    
    /// Deregisters user's account and deletes all associated data.
    func deregister(_ user: User) async throws
    
    /// Authenticates user by checking username-password pair and generating an access token.
    /// In Vapor it happens semi-automatically (see `ModelAuthenticatable`), so this method only generates a token.
    func login(_ user: User, deviceInfo: DeviceInfo, ipAddress: String?) async throws -> User.PrivateInfo
    
    /// Resets user's current authentication (in Vapor) and token to `nil`.
    func logout(_ user: User) async throws
    
    /// Returns full information about current user including all logged in sessions.
    func me(_ user: User) async throws -> User.PrivateInfo
    
    /// Returns full information about current user and active session.
    func current(_ session: DeviceSession) async throws -> User.PrivateInfo
    
    /// Changes password by providing user's current password..
    func changePassword(_ user: User, currentPassword: String, newPassword: String) async throws
    
    /// Resets password by checking the account key.
    /// Empty account key acts as an invalid key and user is not able to restore their account.
    func resetPassword(userId: UserID, newPassword: String, accountKey: String) async throws
    
    /// Sets an account key by providing user's current password.
    func setAccountKey(_ user: User, currentPassword: String, newAccountKey: String) async throws
    
    /// Returns the security question of the account with the given username, the first step of password recovery.
    func securityQuestion(username: String) async throws -> SecurityQuestionInfo
    
    /// Resets the password of the account with the given username if the answer to its security question is correct.
    func resetPassword(username: String, securityAnswer: String, newPassword: String) async throws
    
    /// Returns the current user's security question, or `nil` in `question` if none is set.
    func securityQuestion(of user: User) async throws -> SecurityQuestionInfo
    
    /// Sets a new security question and answer by providing user's current password.
    func setSecurityQuestion(_ user: User, currentPassword: String, question: String, answer: String) async throws
    
    /// Updates current user with the information from the request fields.
    func update(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo
    
    /// Updates current user's device session. The name and the push token of the device can be changed.
    func updateDevice(_ session: DeviceSession, with info: UpdateDeviceSessionRequest) async throws -> User.PrivateInfo
    
    /// Adds photo to the current user.
    func addPhoto(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo
    
    /// Deletes photo from the current user.
    func deletePhoto(_ id: ResourceID, of user: User) async throws
    
    /// List of `count` users starting from `userID` (or the first user if omitted) ordered by registration date.
    func users(from userID: UserID?, count: Int) async throws -> [UserInfo]
    
    /// Get user by `id`.
    /// Pass `fullInfo` = `true` to get additional information about a user.
    func getUser(id: UserID, fullInfo: Bool) async throws -> UserInfo
    
    /// Looking for users with a `username` or `name` using the provided string as a substring for those fields.
    func search(_ s: String) async throws -> [UserInfo]
}

actor UserService: UserServiceProtocol {

    private let core: CoreService
    let repo: UsersRepository
    let settingsService: SettingsServiceProtocol
    var currentUser: User?
    
    init(core: CoreService, repo: UsersRepository, settingsService: SettingsServiceProtocol) {
        self.core = core
        self.repo = repo
        self.settingsService = settingsService
    }
    
    func with(_ currentUser: User?) -> UserService {
        self.currentUser = currentUser
        return self
    }
    
    func register(_ request: RegistrationRequest, ipAddress: String?) async throws -> User.PrivateInfo {
        guard try await settingsService.isRegistrationOpen() else {
            throw ServiceError(.forbidden, reason: "Registration is currently closed.")
        }
        let registration = try validate(registration: request)
        let user = User(name: registration.name,
                        username: registration.username,
                        passwordHash: registration.password.bcryptHash(),
                        accountKeyHash: nil)
        if let question = registration.securityQuestion, let answer = registration.securityAnswer {
            user.securityQuestion = question
            user.securityAnswerHash = answer.bcryptHash()
        }
        try await repo.save(user)
        return try await login(user, deviceInfo: request.deviceInfo, ipAddress: ipAddress)
    }
    
    func deregister(_ user: User) async throws {
        try await repo.delete(user)
    }
    
    func login(_ user: User, deviceInfo: DeviceInfo, ipAddress: String?) async throws -> User.PrivateInfo {
        let deviceSession = DeviceSession(accessToken: generateAccessToken(),
                                          userID: user.id!,
                                          deviceId: deviceInfo.id,
                                          deviceName: deviceInfo.name,
                                          deviceModel: deviceInfo.model,
                                          deviceToken: deviceInfo.token,
                                          pushTransport: deviceInfo.transport.rawValue,
                                          ipAddress: ipAddress)
        try await repo.saveSession(deviceSession)
        try await repo.reloadPhotos(of: user)
        let sessions = try await repo.loadSessions(of: user)
        let sessionId = try deviceSession.requireID()
        return user.privateInfo(with: sessions.first(where: { $0.id == sessionId }))
    }
    
    func logout(_ user: User) async throws {
        try await repo.deleteSession(of: user)
    }
    
    func me(_ user: User) async throws -> User.PrivateInfo {
        try await repo.reloadPhotos(of: user)
        try await repo.loadSessions(of: user)
        return user.privateInfo()
    }
    
    func current(_ session: DeviceSession) async throws -> User.PrivateInfo {
        let user = session.user
        try await repo.reloadPhotos(of: user)
        let sessions = try await repo.loadSessions(of: user)
        let sessionId = try session.requireID()
        return user.privateInfo(with: sessions.first(where: { $0.id == sessionId }))
    }
    
    func changePassword(_ user: User, currentPassword: String, newPassword: String) async throws {
        guard try user.verify(password: currentPassword) else {
            throw CoreService.Errors.invalidPassword
        }
        guard core.passwordPolicy.isValid(newPassword) else {
            throw core.passwordPolicy.error
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
        guard core.passwordPolicy.isValid(newPassword) else {
            throw core.passwordPolicy.error
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
    
    func securityQuestion(username: String) async throws -> SecurityQuestionInfo {
        // An unknown username gets the same answer as an account without a question.
        guard let user = try await repo.find(username: normalizeUsername(username)),
              let question = user.securityQuestion, user.securityAnswerHash != nil else {
            throw CoreService.Errors.noSecurityQuestion
        }
        return SecurityQuestionInfo(question: question)
    }
    
    func resetPassword(username: String, securityAnswer: String, newPassword: String) async throws {
        guard core.passwordPolicy.isValid(newPassword) else {
            throw core.passwordPolicy.error
        }
        // An unknown username gets the same answer as a wrong one.
        guard let user = try await repo.find(username: normalizeUsername(username)),
              try user.verify(securityAnswer: normalizeAnswer(securityAnswer)) else {
            throw CoreService.Errors.invalidSecurityAnswer
        }
        user.passwordHash = newPassword.bcryptHash()
        try await repo.save(user)
    }
    
    func securityQuestion(of user: User) async throws -> SecurityQuestionInfo {
        // The question is public to anyone who knows the username, since recovery hands it out,
        // so returning it needs nothing beyond the session. Changing it is what costs the password.
        SecurityQuestionInfo(question: user.securityQuestion)
    }
    
    func setSecurityQuestion(_ user: User, currentPassword: String, question: String, answer: String) async throws {
        guard try user.verify(password: currentPassword) else {
            throw CoreService.Errors.invalidPassword
        }
        guard case let (question, answer)? = validateSecurityQuestion(question, answer) else {
            throw CoreService.Errors.badSecurityQuestion
        }
        user.securityQuestion = question
        user.securityAnswerHash = answer.bcryptHash()
        try await repo.save(user)
    }
    
    func update(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo {
        if let name = info.name {
            user.name = name
        }
        if let about = info.about {
            user.about = about
        }
        if let language = info.language {
            // Empty string clears the preference
            let code = language.trim()
            if code.isEmpty {
                user.language = nil
            } else {
                guard Language.isValidCode(code) else {
                    throw ServiceError(.badRequest, reason: "Invalid language code.")
                }
                user.language = code
            }
        }
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
        return session.user.privateInfo(with: session)
    }
    
    func addPhoto(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo {
        guard let resource = info.photo, let resourceId = resource.id else {
            throw ServiceError(.badRequest, reason: "Media resource id is missing.")
        }
        guard resource.fileType != "", resource.fileSize > 0 else {
            throw ServiceError(.badRequest, reason: "Media fileType or fileSize are missing.")
        }
        let fileName = "\(resourceId).\(resource.fileType)"
        let uploadedAt = core.fileCreationDate(for: fileName)
        let photo = MediaResource(id: resourceId,
                                  photoOf: user.id!,
                                  fileType: resource.fileType,
                                  fileSize: resource.fileSize,
                                  previewWidth: info.photo?.previewWidth ?? 100,
                                  previewHeight: info.photo?.previewHeight ?? 100,
                                  uploadedAt: uploadedAt)
        try await repo.savePhoto(photo)
        try await repo.reloadPhotos(of: user)
        return user.fullInfo()
    }
    
    func deletePhoto(_ id: ResourceID, of user: User) async throws {
        guard let resource = try await repo.findPhoto(id) else {
            throw ServiceError(.notFound, reason: "Media resource is missing.")
        }
        guard user.id == resource.photoOf?.id else {
            throw ServiceError(.forbidden)
        }
        try await repo.deletePhoto(resource)
        do {
            try core.removeFiles(for: resource)
        } catch {
            core.logger.warning("Couldn't remove files for photo:\n\(error)")
        }
    }
    
    func users(from userID: UserID?, count: Int) async throws -> [UserInfo] {
        let users = try await repo.all(before: userID, count: count)
        return users.map { $0.info() }
    }
    
    func getUser(id: UserID, fullInfo: Bool) async throws -> UserInfo {
        guard let user = try await repo.find(id: id) else {
            throw ServiceError(.notFound)
        }
        if isLoggedIn {
            try await repo.loadSessions(of: user) // TODO: improve privacy - check if the current user is not blocked by the userID and has recent incoming messages
        }
        return fullInfo ? user.fullInfo() : user.info()
    }
    
    func search(_ s: String) async throws -> [UserInfo] {
        if let userId = Int(s), userId > 0 {
            return [try await getUser(id: userId, fullInfo: false)]
        }
        guard s.count >= 2 else {
            throw ServiceError(.notFound)
        }
        let users = try await repo.search(s)
        return users.map { $0.info() }
    }
}

private extension UserService {
    
    func validateAccountKey(_ key: String) -> Bool {
        return key.count >= CoreService.Constants.minAccountKeyLength && key.count <= CoreService.Constants.maxAccountKeyLength
    }
    
    func normalizeUsername(_ username: String) -> String {
        username.normalized().lowercased()
    }
    
    /// Answers are compared trimmed and case-insensitively, so "Paris" and " paris" are the same answer.
    func normalizeAnswer(_ answer: String) -> String {
        answer.normalized().lowercased()
    }
    
    /// Returns the trimmed question and the normalized answer, or `nil` if either is empty or too long.
    func validateSecurityQuestion(_ question: String, _ answer: String) -> (String, String)? {
        let question = question.normalized()
        let answer = normalizeAnswer(answer)
        guard !question.isEmpty, question.count <= CoreService.Constants.maxSecurityQuestionLength,
              !answer.isEmpty, answer.count <= CoreService.Constants.maxSecurityAnswerLength else {
            return nil
        }
        return (question, answer)
    }
    
    func validate(registration: RegistrationRequest) throws -> RegistrationRequest {
        // Older clients send neither the question nor the answer, which is allowed.
        // Sending only one of them, or an empty one, is a mistake and is rejected.
        var securityQuestion: String?
        var securityAnswer: String?
        if registration.securityQuestion != nil || registration.securityAnswer != nil {
            guard case let (question, answer)? = validateSecurityQuestion(registration.securityQuestion ?? "",
                                                                    registration.securityAnswer ?? "") else {
                throw CoreService.Errors.badSecurityQuestion
            }
            securityQuestion = question
            securityAnswer = answer
        }
        let registration = RegistrationRequest(name: registration.name.normalized(),
                                               username: normalizeUsername(registration.username),
                                               password: registration.password,
                                               deviceInfo: registration.deviceInfo,
                                               securityQuestion: securityQuestion,
                                               securityAnswer: securityAnswer)
        guard registration.name.isName else {
            throw CoreService.Errors.badName
        }
        guard registration.username.count >= CoreService.Constants.minUsernameLength &&
              registration.username.count <= CoreService.Constants.maxUsernameLength &&
              registration.username.isAlphanumeric &&
              registration.username.first!.isLetter else {
            throw CoreService.Errors.badUsername
        }
        guard core.passwordPolicy.isValid(registration.password) else {
            throw core.passwordPolicy.error
        }
        return registration
    }
    
    func generateAccessToken() -> String {
        [UInt8].random(count: 32).base64
    }
}
