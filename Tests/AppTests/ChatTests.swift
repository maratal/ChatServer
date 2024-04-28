@testable import App
import XCTVapor

final class ChatTests: XCTestCase {
    
    var app: Application!
    
    override func setUp() {
        app = try! Application.testable()
    }
    
    override func tearDown() {
        app.shutdown()
    }
    
    func testGetUserChats() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([current.requireID(), users[0].requireID()])
        try app.test(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 1)
            XCTAssertEqual(chat.id, chats[0].id)
        })
    }
    
    func testGetUserChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([current.requireID(), users[0].requireID()])
        try app.test(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.participants?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testGetOtherUsersChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([users[0].requireID(), users[1].requireID()])
        try app.test(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }
    
    func testCreateChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].requireID(), users[1].requireID()]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotNil(chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, false)
            XCTAssertEqual(chatInfo.participants?.compactMap({ $0.id }).sorted(), [1, 2, 3])
        })
    }
    
    func testCreatePersonalChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].requireID()]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotNil(chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.participants?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testTryCreateChatDuplicate() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([current.requireID(), users[0].requireID(), users[1].requireID()])
        XCTAssertEqual(chat.isPersonal, false)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].requireID(), users[1].requireID()]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, false)
            XCTAssertEqual(chatInfo.participants?.compactMap({ $0.id }).sorted(), [1, 2, 3])
        })
    }
    
    func testTryCreatePersonalChatDuplicate() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([current.requireID(), users[0].requireID()])
        XCTAssertEqual(chat.isPersonal, true)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].requireID()]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.participants?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testCreatePersonalChatWhenParticipantsKeyDuplicateExists() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([current.requireID(), users[0].requireID(), users[1].requireID()])
        chat.participantsKey = try [current.requireID(), users[0].requireID()].participantsKey()
        try await Repositories.users.saveChat(chat, with: nil)
        XCTAssertEqual(chat.isPersonal, false)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].requireID()]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.participants?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testUpdateChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([current.requireID(), users[0].requireID(), users[1].requireID()])
        XCTAssertNil(chat.title)
        XCTAssertEqual(chat.isPersonal, false)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.title, "Some")
        })
    }
    
    func testUpdatePersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat([current.requireID(), users[0].requireID()])
        XCTAssertNil(chat.title)
        XCTAssertEqual(chat.isPersonal, true)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
}
