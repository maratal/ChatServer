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

struct CurrentUser {
    static let name = "Admin"
    static let username = "admin"
    static let password = "********"
}

@discardableResult
func seedUser(name: String, username: String, password: String) async throws -> User {
    let user = User(name: name, username: username, passwordHash: password.bcryptHash())
    try await Repositories.users.save(user)
    return user
}

@discardableResult
func seedCurrentUser() async throws -> User {
    try await seedUser(name: CurrentUser.name, username: CurrentUser.username, password: CurrentUser.password)
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
func makeChat(ownerId: UserID, users: [UserID], isPersonal: Bool) async throws -> Chat {
    let chat = Chat(ownerId: ownerId, isPersonal: isPersonal)
    try await Repositories.users.saveChat(chat, with: users)
    return chat
}
