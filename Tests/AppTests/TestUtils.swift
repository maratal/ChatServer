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

@discardableResult
func seedUsers(count: Int, namePrefix: String, usernamePrefix: String) async throws -> [User] {
    var users = [User]()
    for i in 1...count {
        let user = User(name: "\(namePrefix) \(i)", username: "\(usernamePrefix)\(i)", passwordHash: "")
        try await Repositories.users.save(user)
        users.append(user)
    }
    return users
}

@discardableResult
func seedCurrentUser() async throws -> User {
    let user = User(name: "Admin", username: "admin", passwordHash: "")
    try await Repositories.users.save(user)
    return user
}

@discardableResult
func makeContact(_ user: User, of owner: User) async throws -> Contact {
    let contact = try Contact(ownerId: owner.requireID(), userId: user.requireID())
    try await Repositories.users.saveContact(contact)
    return contact
}

@discardableResult
func makeChat(_ users: [UserID], isPersonal: Bool = true) async throws -> Chat {
    let chat = Chat(ownerId: users[0], isPersonal: isPersonal, participantsKey: users.participantsKey())
    try await Repositories.users.saveChat(chat, with: users)
    return chat
}
