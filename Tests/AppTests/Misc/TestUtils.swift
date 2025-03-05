@testable import App
import XCTVapor

class AppTestCase: XCTestCase {
    var app: Application!
    var service: CoreService!
    
    override func setUp() {
        (app, service) = try! Application.testable(with: .test)
    }
    
    override func tearDown() {
        app.shutdown()
    }
    
    // This is copied from XCTApplicationTester to avoid "Instance method 'test' is unavailable from asynchronous contexts; Use the async method instead." error regardless using async version.
    @discardableResult
    func asyncTest(
        _ method: HTTPMethod,
        _ path: String,
        headers: HTTPHeaders = [:],
        body: ByteBuffer? = nil,
        file: StaticString = #filePath,
        line: UInt = #line,
        beforeRequest: (inout XCTHTTPRequest) async throws -> () = { _ in },
        afterResponse: (XCTHTTPResponse) async throws -> () = { _ in }
    ) async throws -> XCTApplicationTester {
        var request = XCTHTTPRequest(
            method: method,
            url: .init(path: path),
            headers: headers,
            body: body ?? ByteBufferAllocator().buffer(capacity: 0)
        )
        try await beforeRequest(&request)
        do {
            let response = try await app.performTest(request: request)
            try await afterResponse(response)
        } catch {
            XCTFail("\(String(reflecting: error))", file: file, line: line)
            throw error
        }
        return app
    }
}

class AppLiveTestCase: AppTestCase {

    override func setUp() {
        (app, service) = try! Application.testable(with: .live)
    }
}

extension CoreService {

    static func test(_ app: Application) -> CoreService {
        CoreService(app: app,
                    wsServer: TestWebSocketManager(),
                    notificator: TestNotificationManager())
    }
}

extension Application {

    static func testable(with env: CoreService.Environment = .test) throws -> (Application, CoreService) {
        let app = Application(.testing)
        
        var service: CoreService = env == .test ? .test(app) : .live(app)
        try configure(app, service: &service)
        
        try app.autoRevert().wait()
        try app.autoMigrate().wait()
        
        return (app, service)
    }
}

extension HTTPHeaders {
    
    static let none = HTTPHeaders()
    
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

// MARK: Database

extension CoreService {

    @discardableResult
    mutating func seedUser(name: String, username: String, password: String = "", accountKey: String? = nil) async throws -> User {
        let user = User(name: name, username: username, passwordHash: password.bcryptHash(), accountKeyHash: accountKey?.bcryptHash())
        try await users.repo.save(user)
        return user
    }

    @discardableResult
    mutating func seedUserWithPhoto(name: String, username: String, password: String = "", accountKey: String? = nil) async throws -> (User, MediaResource) {
        let user = User(name: name, username: username, passwordHash: password.bcryptHash(), accountKeyHash: accountKey?.bcryptHash())
        try await users.repo.save(user)
        let resource = try await makeMediaResource(photoOf: user.id!)
        return (user, resource)
    }

    @discardableResult
    mutating func seedCurrentUser(name: String = CurrentUser.name,
                         username: String = CurrentUser.username,
                         password: String = CurrentUser.password,
                         accountKey: String? = CurrentUser.accountKey) async throws -> User {
        try await seedUser(name: name, username: username, password: password, accountKey: accountKey)
    }

    @discardableResult
    mutating func seedUsers(count: Int, namePrefix: String, usernamePrefix: String) async throws -> [User] {
        var users = [User]()
        for i in 1...count {
            try await users.append(seedUser(name: "\(namePrefix) \(i)", username: "\(usernamePrefix)\(i)"))
        }
        return users
    }

    @discardableResult
    mutating func makeContact(_ user: User, of owner: User) async throws -> Contact {
        let contact = try Contact(ownerId: owner.requireID(), userId: user.requireID())
        try await contacts.repo.saveContact(contact)
        return contact
    }

    @discardableResult
    mutating func makeChat(ownerId: UserID, users: [UserID], isPersonal: Bool, blockedId: UserID? = nil, blockedById: UserID? = nil) async throws -> Chat {
        let chat = Chat(ownerId: ownerId, isPersonal: isPersonal)
        try await chats.repo.save(chat, with: users)
        if let blockedId = blockedId {
            guard let relation = try await chats.repo.findRelations(of: chat.id!, isUserBlocked: nil).ofUser(blockedId) else {
                preconditionFailure("Invalid blocked user.")
            }
            relation.isUserBlocked = true
            try await chats.repo.saveRelation(relation)
        }
        if let blockedById = blockedById {
            guard let relation = try await chats.repo.findRelations(of: chat.id!, isUserBlocked: nil).ofUser(blockedById) else {
                preconditionFailure("Invalid blocked user.")
            }
            relation.isChatBlocked = true
            try await chats.repo.saveRelation(relation)
        }
        return chat
    }

    mutating func makeChatWithImage(ownerId: UserID, users: [UserID]) async throws -> (Chat, MediaResource) {
        let chat = try await makeChat(ownerId: ownerId, users: users, isPersonal: false)
        let resource = try await makeMediaResource(imageOf: chat.id!)
        return (chat, resource)
    }

    @discardableResult
    mutating func makeMessage(for chatId: ChatID, authorId: UserID, text: String) async throws -> Message {
        let message = Message(localId: UUID(), authorId: authorId, chatId: chatId, text: text)
        try await chats.repo.saveMessage(message)
        return message
    }

    @discardableResult
    mutating func makeMessageWithAttachment(for chatId: ChatID, authorId: UserID, text: String = "") async throws -> (Message, MediaResource) {
        let message = Message(localId: UUID(), authorId: authorId, chatId: chatId, text: text)
        try await chats.repo.saveMessage(message)
        let resource = try await makeMediaResource(attachmentOf: message.id!)
        return (message, resource)
    }

    @discardableResult
    mutating func makeMessages(for chatId: ChatID, authorId: UserID, count: Int) async throws -> [Message] {
        var messages = [Message]()
        for i in 1...count {
            try await messages.append(makeMessage(for: chatId, authorId: authorId, text: "text \(i)"))
            // Sleep for 1 second, bc url query sends timestamp in unix format and can't select messages with nanosecond precision
            sleep(1)
        }
        return messages
    }

    @discardableResult
    mutating func makeFakeUpload(fileName: String, fileSize: Int) throws -> String {
        let filePath = uploadPath(for: fileName)
        let data = Data(repeating: 1, count: fileSize)
        try (data as NSData).write(toFile: filePath)
        return filePath
    }

    @discardableResult
    mutating func makeMediaResource(photoOf userId: UserID? = nil,
                                    imageOf chatId: ChatID? = nil,
                                    attachmentOf messageId: MessageID? = nil,
                                    fileType: String = "test") async throws -> MediaResource {
        precondition(userId != nil || chatId != nil || messageId != nil)
        let resource = MediaResource(photoOf: userId, imageOf: chatId, attachmentOf: messageId, fileType: fileType, fileSize: 1, previewWidth: 100, previewHeight: 100)
        try await saveItem(resource)
        try makeFakeUpload(fileName: "\(resource.id!).\(resource.fileType)", fileSize: 1)
        try makeFakeUpload(fileName: "\(resource.id!)-preview.\(resource.fileType)", fileSize: 1)
        return resource
    }
}

extension DeviceInfo {
    static let testInfoMobile = DeviceInfo(id: UUID(), name: "My Phone", model: "iPhone", token: "\(UUID())", transport: .apns)
    static let testInfoDesktop = DeviceInfo(id: UUID(), name: "My Mac", model: "MBA", token: "\(UUID())", transport: .web)
}

extension User.PrivateInfo {
    
    func sessionForAccessToken(_ token: String) -> DeviceSession.Info? {
        deviceSessions.first(where: { $0.accessToken == token })
    }
    
    func sessionForDeviceId(_ deviceId: UUID) -> DeviceSession.Info? {
        deviceSessions.first(where: { $0.deviceInfo.id == deviceId })
    }
}

// MARK: Files

extension MediaInfo {
    
    var fileName: String? {
        guard let fileName = self.id else { return nil }
        return "\(fileName).\(fileType)"
    }
    
    var previewFileName: String? {
        guard let fileName = self.id else { return nil }
        return "\(fileName)-preview.\(fileType)"
    }
}

extension CoreService {
    
    func filePath(for resource: MediaInfo) -> String? {
        guard let fileName = resource.fileName else { return nil }
        return uploadPath(for: fileName)
    }
    
    func previewFilePath(for resource: MediaInfo) -> String? {
        guard let fileName = resource.previewFileName else { return nil }
        return uploadPath(for: fileName)
    }
    
    func fileExists(for resource: MediaInfo) -> Bool {
        guard let filePath = filePath(for: resource) else { return false }
        return FileManager.default.fileExists(atPath: filePath)
    }
    
    func previewExists(for resource: MediaInfo) -> Bool {
        guard let filePath = previewFilePath(for: resource) else { return false }
        return FileManager.default.fileExists(atPath: filePath)
    }
}
