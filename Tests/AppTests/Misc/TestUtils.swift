@testable import App
import XCTVapor

extension Application {
    
    static func testable() throws -> Application {
        let app = Application(.testing)
        try configure(app)
        
        try app.autoRevert().wait()
        try app.autoMigrate().wait()
        
        Service.configure(database: app.db,
                          listener: TestWebSocketServer(),
                          notificator: TestNotificationManager())
        return app
    }
}

extension HTTPHeaders {
    
    static var none = HTTPHeaders()
    
    static func filename(_ filename: String, contentType: String) -> Self {
        var headers = HTTPHeaders()
        headers.add(name: "File-Name", value: filename)
        headers.contentType = .fileExtension(contentType)
        return headers
    }
    
    static func authWith(username: String, password: String) -> Self {
        var headers = HTTPHeaders()
        headers.basicAuthorization = .init(username: username, password: password)
        return headers
    }
    
    static func authWith(token: String) -> Self {
        var headers = HTTPHeaders()
        headers.bearerAuthorization = .init(token: token)
        return headers
    }
}

struct CurrentUser {
    static let name = "Admin"
    static let username = "admin"
    static let password = "********"
    static let accountKey = "abcdefghigklmnopqrstuvwxyz"
}

@discardableResult
func seedUser(name: String, username: String, password: String = "", accountKey: String? = nil) async throws -> User {
    let user = User(name: name, username: username, passwordHash: password.bcryptHash(), accountKeyHash: accountKey?.bcryptHash())
    try await Service.users.repo.save(user)
    return user
}

@discardableResult
func seedUserWithPhoto(name: String, username: String, password: String = "", accountKey: String? = nil) async throws -> (User, MediaResource) {
    let user = User(name: name, username: username, passwordHash: password.bcryptHash(), accountKeyHash: accountKey?.bcryptHash())
    try await Service.users.repo.save(user)
    let resource = try await makeMediaResource(photoOf: user.id!)
    return (user, resource)
}

@discardableResult
func seedCurrentUser(name: String = CurrentUser.name,
                     username: String = CurrentUser.username,
                     password: String = CurrentUser.password,
                     accountKey: String? = CurrentUser.accountKey) async throws -> User {
    try await seedUser(name: name, username: username, password: password, accountKey: accountKey)
}

@discardableResult
func seedUsers(count: Int, namePrefix: String, usernamePrefix: String) async throws -> [User] {
    var users = [User]()
    for i in 1...count {
        try await users.append(seedUser(name: "\(namePrefix) \(i)", username: "\(usernamePrefix)\(i)"))
    }
    return users
}

@discardableResult
func makeContact(_ user: User, of owner: User) async throws -> Contact {
    let contact = try Contact(ownerId: owner.requireID(), userId: user.requireID())
    try await Service.contacts.repo.saveContact(contact)
    return contact
}

@discardableResult
func makeChat(ownerId: UserID, users: [UserID], isPersonal: Bool, blockedId: UserID? = nil, blockedById: UserID? = nil) async throws -> Chat {
    let chat = Chat(ownerId: ownerId, isPersonal: isPersonal)
    try await Service.chats.repo.save(chat, with: users)
    if let blockedId = blockedId {
        guard let relation = try await Service.chats.repo.findRelations(of: chat.id!, isUserBlocked: nil).ofUser(blockedId) else {
            preconditionFailure("Invalid blocked user.")
        }
        relation.isUserBlocked = true
        try await Service.chats.repo.saveRelation(relation)
    }
    if let blockedById = blockedById {
        guard let relation = try await Service.chats.repo.findRelations(of: chat.id!, isUserBlocked: nil).ofUser(blockedById) else {
            preconditionFailure("Invalid blocked user.")
        }
        relation.isChatBlocked = true
        try await Service.chats.repo.saveRelation(relation)
    }
    return chat
}

func makeChatWithImage(ownerId: UserID, users: [UserID]) async throws -> (Chat, MediaResource) {
    let chat = try await makeChat(ownerId: ownerId, users: users, isPersonal: false)
    let resource = try await makeMediaResource(imageOf: chat.id!)
    return (chat, resource)
}

@discardableResult
func makeMessage(for chatId: UUID, authorId: UserID, text: String) async throws -> Message {
    let message = Message(localId: UUID(), authorId: authorId, chatId: chatId, text: text)
    try await Service.chats.repo.saveMessage(message)
    return message
}

@discardableResult
func makeMessageWithAttachment(for chatId: UUID, authorId: UserID, text: String = "") async throws -> (Message, MediaResource) {
    let message = Message(localId: UUID(), authorId: authorId, chatId: chatId, text: text)
    try await Service.chats.repo.saveMessage(message)
    let resource = try await makeMediaResource(attachmentOf: message.id!)
    return (message, resource)
}

@discardableResult
func makeMessages(for chatId: UUID, authorId: UserID, count: Int) async throws -> [Message] {
    var messages = [Message]()
    for i in 1...count {
        try await messages.append(makeMessage(for: chatId, authorId: authorId, text: "text \(i)"))
        // Sleep for 1 second, bc url query sends timestamp in unix format and can't select messages with nanosecond precision
        sleep(1)
    }
    return messages
}

@discardableResult
func makeFakeUpload(fileName: String, fileSize: Int) throws -> String {
    let filePath = Application.shared.uploadPath(for: fileName)
    let data = Data(repeating: 1, count: fileSize)
    try (data as NSData).write(toFile: filePath)
    return filePath
}

@discardableResult
func makeMediaResource(photoOf userId: UserID? = nil,
                       imageOf chatId: UUID? = nil,
                       attachmentOf messageId: MessageID? = nil,
                       fileType: String = "test") async throws -> MediaResource {
    precondition(userId != nil || chatId != nil || messageId != nil)
    let resource = MediaResource(photoOf: userId, imageOf: chatId, attachmentOf: messageId, fileType: fileType, fileSize: 1, previewWidth: 100, previewHeight: 100)
    try await Service.saveItem(resource)
    try makeFakeUpload(fileName: "\(resource.id!).\(resource.fileType)", fileSize: 1)
    try makeFakeUpload(fileName: "\(resource.id!)-preview.\(resource.fileType)", fileSize: 1)
    return resource
}

extension DeviceInfo {
    static var testInfoMobile = DeviceInfo(id: UUID(), name: "My Phone", model: "iPhone", token: "\(UUID())", transport: .apns)
    static var testInfoDesktop = DeviceInfo(id: UUID(), name: "My Mac", model: "MBA", token: "\(UUID())", transport: .web)
}

extension User.PrivateInfo {
    
    func sessionForAccessToken(_ token: String) -> DeviceSession.Info? {
        deviceSessions.first(where: { $0.accessToken == token })
    }
    
    func sessionForDeviceId(_ deviceId: UUID) -> DeviceSession.Info? {
        deviceSessions.first(where: { $0.deviceInfo.id == deviceId })
    }
}
