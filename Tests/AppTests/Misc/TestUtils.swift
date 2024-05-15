@testable import App
import XCTVapor

extension Application {
    
    static func testable() throws -> Application {
        let app = Application(.testing)
        try configure(app)
        
        try app.autoRevert().wait()
        try app.autoMigrate().wait()
        
        return app
    }
}

extension HTTPHeaders {
    
    static var none = HTTPHeaders()
    
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

extension MessageInfo {
    
    var seenAt: Date? {
        reactions?.first(where: { $0.user?.id != authorId && $0.badge == Reactions.seen.rawValue })?.createdAt
    }
}

struct CurrentUser {
    static let name = "Admin"
    static let username = "admin"
    static let password = "********"
    static let accountKey = "abcdefghigklmnopqrstuvwxyz"
}

@discardableResult
func seedUser(name: String, username: String, password: String, accountKey: String? = nil) async throws -> User {
    let user = User(name: name, username: username, passwordHash: password.bcryptHash(), accountKeyHash: accountKey?.bcryptHash())
    try await Repositories.users.save(user)
    return user
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
        try await users.append(seedUser(name: "\(namePrefix) \(i)", username: "\(usernamePrefix)\(i)", password: ""))
    }
    return users
}

@discardableResult
func makeContact(_ user: User, of owner: User) async throws -> Contact {
    let contact = try Contact(ownerId: owner.requireID(), userId: user.requireID())
    try await Repositories.users.saveContact(contact)
    return contact
}

@discardableResult
func makeChat(ownerId: UserID, users: [UserID], isPersonal: Bool, blockedId: UserID? = nil) async throws -> Chat {
    let chat = Chat(ownerId: ownerId, isPersonal: isPersonal)
    try await Repositories.chats.save(chat, with: users)
    if let blockedId = blockedId {
        guard let relation = try await Repositories.chats.findRelations(of: chat.id!).ofUser(blockedId) else {
            preconditionFailure("Invalid blocked user.")
        }
        relation.isUserBlocked = true
        try await Repositories.chats.saveRelation(relation)
    }
    return chat
}

@discardableResult
func makeMessage(for chatId: UUID, authorId: UserID, text: String) async throws -> Message {
    let message = Message(localId: UUID(), authorId: authorId, chatId: chatId, text: text)
    try await Repositories.chats.saveMessage(message)
    return message
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
