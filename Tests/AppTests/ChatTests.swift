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
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID()], isPersonal: true)
        
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
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID()], isPersonal: true)
        
        try app.test(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testGetOtherUsersChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].requireID(), users: [users[1].requireID()], isPersonal: true)
        
        try app.test(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }
    
    func testCreateChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(
                CreateChatRequest(participants: [users[0].requireID(), users[1].requireID()], isPersonal: false)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotNil(chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, false)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2, 3])
        })
    }
    
    func testCreatePersonalChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(
                CreateChatRequest(participants: [users[0].requireID()], isPersonal: true)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotNil(chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testTryCreateChatDuplicate() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID(), users[1].requireID()], isPersonal: false)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(
                CreateChatRequest(participants: [users[0].requireID(), users[1].requireID()], isPersonal: false)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, false)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2, 3])
        })
    }
    
    func testTryCreatePersonalChatDuplicate() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID()], isPersonal: true)
        XCTAssertEqual(chat.isPersonal, true)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].requireID()], isPersonal: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testCreatePersonalChatWhenParticipantsKeyDuplicateExists() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID(), users[1].requireID()], isPersonal: false)
        chat.participantsKey = try Set([current.requireID(), users[0].requireID()]).participantsKey()
        try await Repositories.chats.save(chat)
        XCTAssertEqual(chat.isPersonal, false)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].requireID()], isPersonal: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testUpdateChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID(), users[1].requireID()], isPersonal: false)
        
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
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID()], isPersonal: true)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func testUpdateChatSettings() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID(), users[1].requireID()], isPersonal: false)
        let chatRelation = try await Repositories.chats.findRelation(of: chat.requireID(), userId: current.requireID())!
        XCTAssertEqual(chatRelation.isMuted, false)
        
        try app.test(.PUT, "chats/\(chat.id!)/settings", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(isMuted: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isMuted, true)
        })
    }
    
    func testAddUsersToChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID(), users[1].requireID()], isPersonal: false)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await app.test(.POST, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].requireID(), users[2].requireID()]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2, 3, 4])
            let chat = try await Repositories.chats.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2, 3, 4].participantsKey())
        })
    }
    
    func testDeleteUsersFromChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: [users[0].requireID(), users[1].requireID()], isPersonal: false)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await app.test(.DELETE, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].requireID(), users[2].requireID()]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2])
            let chat = try await Repositories.chats.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2].participantsKey())
        })
    }
    
    func testGetChatMessagesPaginated() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: users.map { $0.id! }, isPersonal: true)
        try await makeMessages(for: chat.requireID(), authorId: current.requireID(), count: 9)
        
        let count = 5
        var page1 = [MessageInfo]()
        try app.test(.GET, "chats/\(chat.id!)/messages?count=\(count)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            page1 = try res.content.decode([MessageInfo].self)
            XCTAssertEqual(page1.count, 5)
            XCTAssertEqual(page1.first!.text, "text 9")
            XCTAssertEqual(page1.last!.text, "text 5")
        })
        try app.test(.GET, "chats/\(chat.id!)/messages?count=\(count)&before=\(page1.last!.createdAt!.timeIntervalSinceReferenceDate)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let page2 = try res.content.decode([MessageInfo].self)
            XCTAssertEqual(page2.count, 4)
            XCTAssertEqual(page2.first!.text, "text 4")
            XCTAssertEqual(page2.last!.text, "text 1")
        })
    }
    
    func testPostMessageToChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: users.map { $0.id! }, isPersonal: true)
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let message = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(message.text, "Hey")
            XCTAssertEqual(message.authorId, current.id!)
        })
    }
    
    func testPostMessageToForbiddenChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].requireID(), users: [users[1].requireID()], isPersonal: true)
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testEditMessageInChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: users.map { $0.id! }, isPersonal: true)
        
        var message: MessageInfo!
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            message = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(message.text, "Hey")
            XCTAssertNil(message.editedAt)
            XCTAssertNotNil(message.createdAt)
        })
        
        sleep(1)
        
        try app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(text: "Hi")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let updatedMessage = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(updatedMessage.id, message.id)
            XCTAssertEqual(updatedMessage.text, "Hi")
            XCTAssertNotNil(updatedMessage.editedAt)
            XCTAssertNotNil(updatedMessage.createdAt)
            XCTAssertTrue(updatedMessage.editedAt! > updatedMessage.createdAt!)
        })
    }
    
    func testReadMessageInChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: users.map { $0.id! }, isPersonal: true)
        let message = try await makeMessages(for: chat.requireID(), authorId: users[0].requireID(), count: 1).first!
        let messageInfo = try await Repositories.chats.findMessage(id: message.id!)!.info()
        XCTAssertNil(messageInfo.seenAt)
        
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try await Repositories.chats.findMessage(id: message.id!)!.info()
            XCTAssertEqual(info.reactions?.count, 1)
            XCTAssertNotNil(info.seenAt)
        })
        
        // Second similar request should be ignored by the server
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try await Repositories.chats.findMessage(id: message.id!)!.info()
            XCTAssertEqual(info.reactions?.count, 1)
            XCTAssertNotNil(info.seenAt)
        })
    }
    
    func testDeleteMessageInChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.requireID(), users: users.map { $0.id! }, isPersonal: true)
        let message = try await makeMessages(for: chat.requireID(), authorId: current.requireID(), count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        
        try app.test(.DELETE, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let updatedMessage = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(updatedMessage.id, message.id)
            XCTAssertEqual(updatedMessage.text, "")
        })
    }
}
