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
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testTryGetOtherUsersChat() async throws {
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
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2, 3])
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
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2])
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
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2, 3])
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
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testCreatePersonalChatWhenParticipantsKeyDuplicateExists() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        chat.participantsKey = Set([current.id!, users[0].id!]).participantsKey()
        try await Service.chats.repo.save(chat)
        XCTAssertEqual(chat.isPersonal, false)
        
        try app.test(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].id!], isPersonal: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func testBlockAndUnblockChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)!
        XCTAssertEqual(relation.isChatBlocked, false)
        
        try await app.test(.PUT, "chats/\(chat.id!)/block", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
            XCTAssertEqual(relation?.isChatBlocked, true)
        })
        try await app.test(.PUT, "chats/\(chat.id!)/unblock", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
            XCTAssertEqual(relation?.isChatBlocked, false)
        })
    }
    
    func testBlockAndUnblockUserInChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: users[0].id!)!
        XCTAssertEqual(relation.isUserBlocked, false)
        
        try await app.test(.PUT, "chats/\(chat.id!)/users/\(users[0].id!)/block", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: users[0].id!)
            XCTAssertEqual(relation?.isUserBlocked, true)
        })
        try await app.test(.PUT, "chats/\(chat.id!)/users/\(users[0].id!)/unblock", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: users[0].id!)
            XCTAssertEqual(relation?.isUserBlocked, false)
        })
    }
    
    func testGetBlockedUsersInChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false, blockedId: users[0].id)
        
        try app.test(.GET, "chats/\(chat.id!)/users/blocked", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let blockedUsers = try res.content.decode([UserInfo].self)
            XCTAssertEqual(blockedUsers.count, 1)
            XCTAssertEqual(blockedUsers[0].id, 2)
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
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 3)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .chatUpdate)
        })
    }
    
    func testTryUpdateChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false, blockedId: current.id)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testTryUpdatePersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
        try app.test(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func testTryUpdatePersonalChatByBlockedUser() async throws {
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
        let chatRelation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)!
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
    
    func testAddAndDeleteChatImage() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        
        let fileId = UUID()
        let fileName = fileId.uuidString
        let fileType = "test"
        
        // "Upload" all files before adding image
        let uploadPath = try app.makeFakeUpload(fileName: fileName + "." + fileType, fileSize: 1)
        let previewPath = try app.makeFakeUpload(fileName: fileName + "-preview." + fileType, fileSize: 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertTrue(FileManager.default.fileExists(atPath: previewPath))
        
        try app.test(.POST, "chats/\(chat.id!)/images", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(image: MediaInfo(id: fileId, fileType: fileType, fileSize: 1)))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chatInfo.images?.count, 1)
            XCTAssertEqual(chatInfo.images?[0].fileExists, true)
            XCTAssertEqual(chatInfo.images?[0].previewExists, true)
        })
        
        try app.test(.DELETE, "chats/\(chat.id!)/images/\(fileId)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })

        // Check if all files were removed
        XCTAssertFalse(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: previewPath))
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
            XCTAssertEqual(chatInfo.addedUsers?.compactMap({ $0.id }).sorted(), [4])
            let chat = try await Service.chats.repo.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2, 3, 4].participantsKey())
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 4)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .addedUsers)
        })
    }
    
    func testTryAddUsersToChatByBlockedUser() async throws {
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
    
    func testRemoveUsersFromChat() async throws {
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
            XCTAssertEqual(chatInfo.removedUsers?.compactMap({ $0.id }).sorted(), [3])
            let chat = try await Service.chats.repo.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2].participantsKey())
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 2)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .removedUsers)
        })
    }
    
    func testTryRemoveUsersFromChatByBlockedUser() async throws {
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
    
    func testTryGetChatMessagesPaginatedByBlockedUser() async throws {
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
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let message = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(message.text, "Hey")
            XCTAssertEqual(message.authorId, current.id!)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 3)
            XCTAssertEqual(Service.testNotificator.sentNotifications.filter { $0.event == .message }.count, 3)
        })
    }
    
    func testPostMessageToBlockedChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false, blockedById: users[0].id)
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let message = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(message.text, "Hey")
            XCTAssertEqual(message.authorId, current.id!)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 2)
            XCTAssertEqual(Service.testNotificator.sentNotifications.filter { $0.event == .message }.count, 2)
            XCTAssertEqual(Service.testNotificator.sentNotifications.filter { $0.destination == "\(users[0].id!)" }.count, 0)
            XCTAssertEqual(Service.testNotificator.sentNotifications.filter { $0.destination != "\(users[0].id!)" }.count, 2)
        })
    }
    
    func testTryPostMessageToChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false, blockedId: current.id)
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testTryPostMessageToBlockedPersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedById: users[0].id)
        
        try app.test(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID(), text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testTryPostMessageToOtherUsersChat() async throws {
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
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 2)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .messageUpdate)
        })
    }
    
    func testTryEditMessageInChatByBlockedUser() async throws {
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
        let messageInfo = try await Service.chats.repo.findMessage(id: message.id!)!.info()
        XCTAssertNil(messageInfo.readAt)
        
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try await Service.chats.repo.findMessage(id: message.id!)!.info()
            XCTAssertEqual(info.readMarks?.count, 1)
            XCTAssertNotNil(info.readAt)
        })
        
        // Second similar request should be ignored by the server
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try await Service.chats.repo.findMessage(id: message.id!)!.info()
            XCTAssertEqual(info.readMarks?.count, 1)
            XCTAssertNotNil(info.readAt)
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
            XCTAssertNotNil(updatedMessage.deletedAt)
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
            XCTAssertNotNil(updatedMessage.deletedAt)
        })
    }
    
    func testDeleteChatOnDevice() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)!
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
        // Add readMark, should be deleted together with the messages
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let readMarks = try await Service.chats.repo.findReadMarks(for: message.id!)
            XCTAssertEqual(readMarks.count, 1)
        })
        try app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            XCTAssertTrue(Service.testNotificator.sentNotifications.contains(where: { $0.event == .chatDeleted }))
        })
        try await app.test(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 0)
            let readMarks = try await Service.chats.repo.findReadMarks(for: message.id!)
            XCTAssertEqual(readMarks.count, 0)
        })
    }
    
    func testTryDeleteChatNotOwningIt() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        
        try app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, "Only owner should be able to delete group chat - " + res.body.string)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 0)
        })
    }
    
    func testDeletePersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
        try await app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try await Service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 0)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 2)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .chatDeleted)
        })
    }
    
    func testDeletePersonalChatNotOwningIt() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)

        try await app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Both users should be able to delete personal chat - " + res.body.string)
            let chats = try await Service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 0)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 2)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .chatDeleted)
        })
    }
    
    func testDeletePersonalChatByBlockedUser() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true, blockedId: current.id)
        let message = try await makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Even blocked users should be able to delete personal chat - " + res.body.string)
            let chats = try await Service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 0)
            let message = try await Service.chats.repo.findMessage(id: message.id!)
            XCTAssertNil(message)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 1)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .chatDeleted)
        })
    }
    
    func testExitChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
        XCTAssertNotNil(relation)
        
        try await app.test(.DELETE, "chats/\(chat.id!)/exit", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
            XCTAssertNil(relation)
        })
    }
    
    func testTryExitPersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)
        let relation = try await Service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
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
            let chats = try await Service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 1)
            let message = try await Service.chats.repo.findMessage(id: message.id!)
            XCTAssertNil(message)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 2)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .chatCleared)
        })
    }
    
    func testTryClearChatNotOwningIt() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        
        try app.test(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, "Only owner should be able to clear messages in a group chat - " + res.body.string) // Questionable
        })
    }
    
    func testClearPersonalChat() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)
        let message = try await makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try await Service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 1)
            let message = try await Service.chats.repo.findMessage(id: message.id!)
            XCTAssertNil(message)
            XCTAssertEqual(Service.testNotificator.sentNotifications.count, 2)
            XCTAssertTrue(Service.testNotificator.sentNotifications[0].event == .chatCleared)
        })
    }
}
