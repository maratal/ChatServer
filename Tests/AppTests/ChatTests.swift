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
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
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
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
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
        let chat = try await makeChat(ownerId: users[0].id!, users: [users[1].id!], isPersonal: true)
        
        try app.test(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }
    
    func testCreateChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(
                CreateChatRequest(participants: [users[0].id!, users[1].id!], isPersonal: false)
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
                CreateChatRequest(participants: [users[0].id!], isPersonal: true)
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
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(
                CreateChatRequest(participants: [users[0].id!, users[1].id!], isPersonal: false)
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
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        XCTAssertEqual(chat.isPersonal, true)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].id!], isPersonal: true))
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
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        chat.participantsKey = Set([current.id!, users[0].id!]).participantsKey()
        try await Repositories.chats.save(chat)
        XCTAssertEqual(chat.isPersonal, false)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].id!], isPersonal: true))
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
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.title, "Some")
        })
    }
    
    func testUpdateChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false, blockedId: current.id)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testUpdatePersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func testUpdatePersonalChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true, blockedId: current.id)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertNotEqual(res.status, .ok, res.body.string)
        })
    }
    
    func testUpdateChatSettings() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        let chatRelation = try await Repositories.chats.findRelation(of: chat.id!, userId: current.id!)!
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
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await app.test(.POST, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2, 3, 4])
            let chat = try await Repositories.chats.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2, 3, 4].participantsKey())
        })
    }
    
    func testAddUsersToChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false, blockedId: current.id)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try app.test(.POST, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testDeleteUsersFromChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await app.test(.DELETE, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.users?.compactMap({ $0.id }).sorted(), [1, 2])
            let chat = try await Repositories.chats.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2].participantsKey())
        })
    }
    
    func testDeleteUsersFromChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false, blockedId: current.id)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try app.test(.DELETE, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testGetChatMessagesPaginated() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        try await makeMessages(for: chat.id!, authorId: current.id!, count: 9)
        
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
    
    func testGetChatMessagesPaginatedByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedId: current.id)
        try await makeMessages(for: chat.id!, authorId: current.id!, count: 9)
        
        try app.test(.GET, "chats/\(chat.id!)/messages?count=5", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testPostMessageToChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        
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
    
    func testPostMessageToChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedId: current.id)
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testPostMessageToForbiddenChat() async throws {
        try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [users[1].id!], isPersonal: true)
        
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
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let message = try await makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        sleep(1)
        
        try app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(text: "Hi")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let updatedMessage = try res.content.decode(MessageInfo.self)
            guard updatedMessage.id != nil else {
                return XCTFail("Message should have an id.")
            }
            XCTAssertEqual(updatedMessage.id, message.id)
            XCTAssertEqual(updatedMessage.text, "Hi")
            XCTAssertNotNil(updatedMessage.editedAt)
            XCTAssertNotNil(updatedMessage.createdAt)
            XCTAssertTrue(updatedMessage.editedAt! > updatedMessage.createdAt!)
        })
    }
    
    func testEditMessageInChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedId: current.id)
        let message = try await makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        sleep(1)
        
        try app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(text: "Hi")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testReadMessageInChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let message = try await makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
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
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let message = try await makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        
        try app.test(.DELETE, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            // Message is deleted by deletion of its content:
            let updatedMessage = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(updatedMessage.id, message.id)
            XCTAssertEqual(updatedMessage.text, "")
            XCTAssertEqual(updatedMessage.fileSize, 0)
        })
        // Try to edit deleted message
        try app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(text: "Hi")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func testDeleteMessageInChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedId: current.id)
        let message = try await makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        
        try app.test(.DELETE, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Even blocked users should be able to delete messages in a chat - " + res.body.string)
            let updatedMessage = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(updatedMessage.id, message.id)
            XCTAssertEqual(updatedMessage.text, "")
            XCTAssertEqual(updatedMessage.fileSize, 0)
        })
    }
    
    func testDeleteChatOnDevice() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        let relation = try await Repositories.chats.findRelation(of: chat.id!, userId: current.id!)!
        XCTAssertEqual(relation.isRemovedOnDevice, false)
        
        try app.test(.PUT, "chats/\(chat.id!)/settings", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(isRemovedOnDevice: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 0)
        })
    }
    
    func testDeleteChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        let message = try await makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try app.test(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 1)
        })
        // Add reaction, should be deleted together with the messages
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let reactions = try await Repositories.chats.findReactions(for: message.id!)
            XCTAssertEqual(reactions.count, 1)
        })
        try app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await app.test(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 0)
            let reactions = try await Repositories.chats.findReactions(for: message.id!)
            XCTAssertEqual(reactions.count, 0)
        })
    }
    
    func testTryDeleteChatNotOwningIt() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        
        try app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, "Only owner should be able to delete multiuser chat - " + res.body.string)
        })
    }
    
    func testDeletePersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
        try app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func testDeletePersonalChatNotOwningIt() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)

        try app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Both users should be able to delete personal chat - " + res.body.string)
        })
    }
    
    func testDeletePersonalChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true, blockedId: current.id)
        let message = try await makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Even blocked users should be able to delete personal chat - " + res.body.string)
            // Chat itself wasn't removed to keep relation with block settings, but messages should be deleted:
            let chats = try await Repositories.chats.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 1)
            let message = try await Repositories.chats.findMessage(id: message.id!)
            XCTAssertNil(message)
        })
    }
    
    func testExitChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        let relation = try await Repositories.chats.findRelation(of: chat.id!, userId: current.id!)
        XCTAssertNotNil(relation)
        
        try await app.test(.DELETE, "chats/\(chat.id!)/exit", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Repositories.chats.findRelation(of: chat.id!, userId: current.id!)
            XCTAssertNil(relation)
        })
    }
    
    func testTryExitPersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)
        let relation = try await Repositories.chats.findRelation(of: chat.id!, userId: current.id!)
        XCTAssertNotNil(relation)
        
        try app.test(.DELETE, "chats/\(chat.id!)/exit", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func testClearChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        let message = try await makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try await Repositories.chats.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 1)
            let message = try await Repositories.chats.findMessage(id: message.id!)
            XCTAssertNil(message)
        })
    }
    
    func testClearChatNotOwningIt() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        
        try app.test(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, "Only owner should be able to clear messages in a multiuser chat - " + res.body.string) // Questionable
        })
    }
    
    func testClearPersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)
        let message = try await makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try await Repositories.chats.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 1)
            let message = try await Repositories.chats.findMessage(id: message.id!)
            XCTAssertNil(message)
        })
    }
    
    func testBlockAndUnblockUserInChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        let relation = try await Repositories.chats.findRelation(of: chat.id!, userId: users[0].id!)!
        XCTAssertEqual(relation.isBlocked, false)
        
        try await app.test(.PUT, "chats/\(chat.id!)/users/\(users[0].id!)/block", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Repositories.chats.findRelation(of: chat.id!, userId: users[0].id!)
            XCTAssertEqual(relation?.isBlocked, true)
        })
        try await app.test(.PUT, "chats/\(chat.id!)/users/\(users[0].id!)/unblock", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Repositories.chats.findRelation(of: chat.id!, userId: users[0].id!)
            XCTAssertEqual(relation?.isBlocked, false)
        })
    }
}
