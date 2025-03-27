@testable import App
import XCTVapor

final class ChatTests: AppTestCase {
    
    func test_01_getUserChats() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat1 = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        let (chat2, resource) = try await service.makeChatWithImage(ownerId: current.id!, users: [users[0].id!])
        
        try await asyncTest(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 2)
            XCTAssertFalse(chats.contains(where: { $0.allUsers?.count == 2 }))
            XCTAssertTrue(chats.contains(where: { $0.images?.count == 1 }))
            XCTAssertEqual([chat1, chat2].map { $0.id! }.sorted(), chats.map { $0.id! }.sorted())
        })
        
        try await asyncTest(.GET, "chats/?full=1", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 2)
            XCTAssertTrue(chats.contains(where: { $0.allUsers?.count == 2 }))
            XCTAssertTrue(chats.contains(where: { $0.images?.count == 1 }))
            XCTAssertEqual([chat1, chat2].map { $0.id! }.sorted(), chats.map { $0.id! }.sorted())
        })
        try service.removeFiles(for: resource)
    }
    
    func test_02_getChat() async throws {
        let current = try await service.seedCurrentUser()
        let (user, photoRes) = try await service.seedUserWithPhoto(name: "User", username: "user")
        let (chat, imageRes) = try await service.makeChatWithImage(ownerId: current.id!, users: [user.id!])
        
        try await asyncTest(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.images?.count, 1)
            let chatUsers = chatInfo.allUsers?.sorted(by: { $0.id! < $1.id! })
            XCTAssertEqual(chatUsers?.compactMap { $0.id }, [1, 2])
            XCTAssertEqual(chatUsers?.last?.photos?.count, 1)
            try service.removeFiles(for: photoRes)
            try service.removeFiles(for: imageRes)
        })
    }
    
    func test_03_getPersonalChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
        try await asyncTest(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func test_04_tryGetOtherUsersChat() async throws {
        try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [users[1].id!], isPersonal: true)
        
        try await asyncTest(.GET, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }
    
    func test_05_createChat() async throws {
        try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        
        try await asyncTest(.POST, "chats", headers: .none, beforeRequest: { req in
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
    
    func test_06_createPersonalChat() async throws {
        try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        
        try await asyncTest(.POST, "chats", headers: .none, beforeRequest: { req in
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
    
    func test_07_tryCreateChatDuplicate() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        
        try await asyncTest(.POST, "chats", headers: .none, beforeRequest: { req in
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
    
    func test_08_tryCreatePersonalChatDuplicate() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        XCTAssertEqual(chat.isPersonal, true)
        
        try await asyncTest(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].id!], isPersonal: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func test_09_createPersonalChatWhenParticipantsKeyDuplicateExists() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        chat.participantsKey = Set([current.id!, users[0].id!]).participantsKey()
        try await service.chats.repo.save(chat)
        XCTAssertEqual(chat.isPersonal, false)
        
        try await asyncTest(.POST, "chats", headers: .none, beforeRequest: { req in
            try req.content.encode(CreateChatRequest(participants: [users[0].id!], isPersonal: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertNotEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isPersonal, true)
            XCTAssertEqual(chatInfo.allUsers?.compactMap({ $0.id }).sorted(), [1, 2])
        })
    }
    
    func test_10_blockAndUnblockChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)!
        XCTAssertEqual(relation.isChatBlocked, false)
        
        try await app.test(.PUT, "chats/\(chat.id!)/block", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
            XCTAssertEqual(relation?.isChatBlocked, true)
        })
        try await app.test(.PUT, "chats/\(chat.id!)/unblock", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
            XCTAssertEqual(relation?.isChatBlocked, false)
        })
    }
    
    func test_11_blockAndUnblockUserInChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: users[0].id!)!
        XCTAssertEqual(relation.isUserBlocked, false)
        
        try await app.test(.PUT, "chats/\(chat.id!)/users/\(users[0].id!)/block", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: users[0].id!)
            XCTAssertEqual(relation?.isUserBlocked, true)
        })
        try await app.test(.PUT, "chats/\(chat.id!)/users/\(users[0].id!)/unblock", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: users[0].id!)
            XCTAssertEqual(relation?.isUserBlocked, false)
        })
    }
    
    func test_12_getBlockedUsersInChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false, blockedId: users[0].id)
        
        try await asyncTest(.GET, "chats/\(chat.id!)/users/blocked", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let blockedUsers = try res.content.decode([UserInfo].self)
            XCTAssertEqual(blockedUsers.count, 1)
            XCTAssertEqual(blockedUsers[0].id, 2)
        })
    }
    
    func test_13_updateChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        
        try await asyncTest(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.title, "Some")
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 3)
            XCTAssertTrue(sentNotifications[0].event == .chatUpdate)
        })
    }
    
    func test_14_tryUpdateChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false, blockedId: current.id)
        
        try await asyncTest(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_15_tryUpdatePersonalChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
        try await asyncTest(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func test_16_tryUpdatePersonalChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true, blockedId: current.id)
        
        try await asyncTest(.PUT, "chats/\(chat.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(title: "Some"))
        }, afterResponse: { res in
            XCTAssertNotEqual(res.status, .ok, res.body.string)
        })
    }
    
    func test_17_updateChatSettings() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        let chatRelation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)!
        XCTAssertEqual(chatRelation.isMuted, false)
        
        try await asyncTest(.PUT, "chats/\(chat.id!)/settings", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(isMuted: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.isMuted, true)
        })
    }
    
    func test_18_addAndDeleteChatImage() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        
        let fileId = UUID()
        let fileName = fileId.uuidString
        let fileType = "test"
        
        // "Upload" all files before adding image
        let uploadPath = try service.makeFakeUpload(fileName: fileName + "." + fileType, fileSize: 1)
        let previewPath = try service.makeFakeUpload(fileName: fileName + "-preview." + fileType, fileSize: 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertTrue(FileManager.default.fileExists(atPath: previewPath))
        
        try await asyncTest(.POST, "chats/\(chat.id!)/images", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(image: MediaInfo(id: fileId, fileType: fileType, fileSize: 1)))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chatInfo.images?.count, 1)
            XCTAssertTrue(service.fileExists(for: chatInfo.images![0]))
            XCTAssertTrue(service.previewExists(for: chatInfo.images![0]))
        })
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)/images/\(fileId)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        
        // Check if all files were removed
        XCTAssertFalse(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: previewPath))
    }
    
    func test_19_addUsersToChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await app.test(.POST, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.addedUsers?.compactMap({ $0.id }).sorted(), [4])
            let chat = try await service.chats.repo.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2, 3, 4].participantsKey())
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 4)
            XCTAssertTrue(sentNotifications[0].event == .addedUsers)
        })
    }
    
    func test_20_tryAddUsersToChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false, blockedId: current.id)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await asyncTest(.POST, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_21_removeUsersFromChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await app.test(.DELETE, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chatInfo = try res.content.decode(ChatInfo.self)
            XCTAssertEqual(chat.id, chatInfo.id)
            XCTAssertEqual(chatInfo.removedUsers?.compactMap({ $0.id }).sorted(), [3])
            let chat = try await service.chats.repo.fetch(id: chat.id!)
            XCTAssertEqual(chat.participantsKey, [1, 2].participantsKey())
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertTrue(sentNotifications[0].event == .removedUsers)
        })
    }
    
    func test_22_tryRemoveUsersFromChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 3, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!, users[1].id!], isPersonal: false, blockedId: current.id)
        XCTAssertEqual(chat.participantsKey, [1, 2, 3].participantsKey())
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)/users", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatUsersRequest(users: [users[1].id!, users[2].id!]))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_23_getChatMessagesPaginated() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        try await service.makeMessages(for: chat.id!, authorId: current.id!, count: 8)
        let (_, messageRes) = try await service.makeMessageWithAttachment(for: chat.id!, authorId: current.id!, text: "pic")
        
        let count = 5
        var page1 = [MessageInfo]()
        try await asyncTest(.GET, "chats/\(chat.id!)/messages?count=\(count)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            page1 = try res.content.decode([MessageInfo].self)
            XCTAssertEqual(page1.count, 5)
            XCTAssertEqual(page1.first?.text, "pic")
            XCTAssertEqual(page1.first?.attachments?.count, 1)
            XCTAssertEqual(page1.last?.text, "text 5")
        })
        try await asyncTest(.GET, "chats/\(chat.id!)/messages?count=\(count)&before=\(page1.last!.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let page2 = try res.content.decode([MessageInfo].self)
            XCTAssertEqual(page2.count, 4)
            XCTAssertEqual(page2.first?.text, "text 4")
            XCTAssertEqual(page2.last?.text, "text 1")
        })
        try service.removeFiles(for: messageRes)
    }
    
    func test_24_tryGetChatMessagesPaginatedByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedId: current.id)
        try await service.makeMessages(for: chat.id!, authorId: current.id!, count: 9)
        
        try await asyncTest(.GET, "chats/\(chat.id!)/messages?count=5", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_25_postMessageToChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        
        try await asyncTest(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID().uuidString, text: "Hey")
            )
        }, afterResponse: { res in
            guard res.status == .ok else {
                return XCTFail("Error response: " + res.body.string)
            }
            XCTAssertEqual(res.status, .ok, res.body.string)
            let message = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(message.text, "Hey")
            XCTAssertEqual(message.authorId, current.id!)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 3)
            XCTAssertEqual(sentNotifications.filter { $0.event == .message }.count, 3)
        })
    }
    
    func test_26_postAndDeleteChatMessageWithAttachment() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        
        var message: MessageInfo!
        var attachment: MediaInfo!
        let fileType = "test"
        
        try await asyncTest(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID().uuidString, attachment: MediaInfo(fileType: fileType, fileSize: 1))
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            message = try res.content.decode(MessageInfo.self)
            attachment = try XCTUnwrap(message.attachments?.first)
            XCTAssertFalse(service.fileExists(for: attachment))
            XCTAssertFalse(service.previewExists(for: attachment))
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertEqual(sentNotifications.filter { $0.event == .message }.count, 2)
        })
        
        await service.testNotificator.clearSentNotifications()
        
        let fileId = try XCTUnwrap(attachment.id?.uuidString)
        
        // "Upload" file and preview
        try service.makeFakeUpload(fileName: fileId + "." + fileType, fileSize: 1)
        try service.makeFakeUpload(fileName: fileId + "-preview." + fileType, fileSize: 1)
        
        // Inform chat users that upload is now completed and their clients can update the UI
        try await asyncTest(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                UpdateMessageRequest(fileExists: true, previewExists: true)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            message = try res.content.decode(MessageInfo.self)
            attachment = try XCTUnwrap(message.attachments?.first)
            XCTAssertTrue(service.fileExists(for: attachment))
            XCTAssertTrue(service.previewExists(for: attachment))
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertEqual(sentNotifications.filter { $0.event == .messageUpdate }.count, 2)
        })
        
        await service.testNotificator.clearSentNotifications()
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            message = try res.content.decode(MessageInfo.self)
            attachment = try XCTUnwrap(message.attachments?.first)
            XCTAssertNotNil(message.deletedAt)
            XCTAssertFalse(service.fileExists(for: attachment))
            XCTAssertFalse(service.previewExists(for: attachment))
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertEqual(sentNotifications.filter { $0.event == .messageUpdate }.count, 2)
        })
    }
    
    func test_27_postMessageToBlockedChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false, blockedById: users[0].id)
        
        try await asyncTest(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID().uuidString, text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let message = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(message.text, "Hey")
            XCTAssertEqual(message.authorId, current.id!)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertEqual(sentNotifications.filter { $0.event == .message }.count, 2)
            XCTAssertEqual(sentNotifications.filter { $0.destination == "\(users[0].id!)" }.count, 0)
            XCTAssertEqual(sentNotifications.filter { $0.destination != "\(users[0].id!)" }.count, 2)
        })
    }
    
    func test_28_tryPostMessageToChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false, blockedId: current.id)
        
        try await asyncTest(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID().uuidString, text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_29_tryPostMessageToBlockedPersonalChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedById: users[0].id)
        
        try await asyncTest(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID().uuidString, text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_30_tryPostMessageToOtherUsersChat() async throws {
        try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [users[1].id!], isPersonal: true)
        
        try await asyncTest(.POST, "chats/\(chat.id!)/messages", headers: .none, beforeRequest: { req in
            try req.content.encode(
                PostMessageRequest(localId: UUID().uuidString, text: "Hey")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_31_editMessageInChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let message = try await service.makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        sleep(1)
        
        try await asyncTest(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                UpdateMessageRequest(text: "Hi")
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
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertTrue(sentNotifications[0].event == .messageUpdate)
        })
    }
    
    func test_32_tryEditMessageInChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedId: current.id)
        let message = try await service.makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        
        try await asyncTest(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                UpdateMessageRequest(text: "Hi")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_33_readMessageInChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let message = try await service.makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        let messageInfo = try await service.chats.repo.findMessage(id: message.id!)!.info()
        XCTAssertNil(messageInfo.readAt)
        
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try await service.chats.repo.findMessage(id: message.id!)!.info()
            XCTAssertEqual(info.readMarks?.count, 1)
            XCTAssertNotNil(info.readAt)
        })
        
        // Second similar request should be ignored by the server
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try await service.chats.repo.findMessage(id: message.id!)!.info()
            XCTAssertEqual(info.readMarks?.count, 1)
            XCTAssertNotNil(info.readAt)
        })
    }
    
    func test_34_deleteMessageInChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let message = try await service.makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            // Message is deleted by deletion of its content:
            let updatedMessage = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(updatedMessage.id, message.id)
            XCTAssertEqual(updatedMessage.text, "")
            XCTAssertNotNil(updatedMessage.deletedAt)
        })
        // Try to edit deleted message
        try await asyncTest(.PUT, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, beforeRequest: { req in
            try req.content.encode(
                UpdateMessageRequest(text: "Hi")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func test_35_deleteMessageInChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true, blockedId: current.id)
        let message = try await service.makeMessages(for: chat.id!, authorId: current.id!, count: 1).first!
        XCTAssertEqual(message.text, "text 1")
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)/messages/\(message.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Even blocked users should be able to delete messages in a chat - " + res.body.string)
            let updatedMessage = try res.content.decode(MessageInfo.self)
            XCTAssertEqual(updatedMessage.id, message.id)
            XCTAssertEqual(updatedMessage.text, "")
            XCTAssertNotNil(updatedMessage.deletedAt)
        })
    }
    
    func test_36_deleteChatOnDevice() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)!
        XCTAssertEqual(relation.isRemovedOnDevice, false)
        
        try await asyncTest(.PUT, "chats/\(chat.id!)/settings", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateChatRequest(isRemovedOnDevice: true))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 0)
        })
    }
    
    func test_37_deleteChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        let message = try await service.makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await asyncTest(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 1)
        })
        // Add readMark, should be deleted together with the messages
        try await app.test(.PUT, "chats/\(chat.id!)/messages/\(message.id!)/read", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let readMarks = try await service.chats.repo.findReadMarks(for: message.id!)
            XCTAssertEqual(readMarks.count, 1)
        })
        try await asyncTest(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertTrue(sentNotifications.contains(where: { $0.event == .chatDeleted }))
        })
        try await app.test(.GET, "chats", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try res.content.decode([ChatInfo].self)
            XCTAssertEqual(chats.count, 0)
            let readMarks = try await service.chats.repo.findReadMarks(for: message.id!)
            XCTAssertEqual(readMarks.count, 0)
        })
    }
    
    func test_38_tryDeleteChatNotOwningIt() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, "Only owner should be able to delete group chat - " + res.body.string)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 0)
        })
    }
    
    func test_39_deletePersonalChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: true)
        
        try await app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try await service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 0)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertTrue(sentNotifications[0].event == .chatDeleted)
        })
    }
    
    func test_40_deletePersonalChatNotOwningIt() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)
        
        try await app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Both users should be able to delete personal chat - " + res.body.string)
            let chats = try await service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 0)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertTrue(sentNotifications[0].event == .chatDeleted)
        })
    }
    
    func test_41_deletePersonalChatByBlockedUser() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true, blockedId: current.id)
        let message = try await service.makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, "Even blocked users should be able to delete personal chat - " + res.body.string)
            let chats = try await service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 0)
            let message = try await service.chats.repo.findMessage(id: message.id!)
            XCTAssertNil(message)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 1)
            XCTAssertTrue(sentNotifications[0].event == .chatDeleted)
        })
    }
    
    func test_42_exitChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
        XCTAssertNotNil(relation)
        
        try await app.test(.DELETE, "chats/\(chat.id!)/me", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
            XCTAssertNil(relation)
        })
    }
    
    func test_43_tryExitPersonalChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)
        let relation = try await service.chats.repo.findRelation(of: chat.id!, userId: current.id!)
        XCTAssertNotNil(relation)
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)/me", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func test_44_clearChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: [users[0].id!], isPersonal: false)
        let message = try await service.makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try await service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 1)
            let message = try await service.chats.repo.findMessage(id: message.id!)
            XCTAssertNil(message)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertTrue(sentNotifications[0].event == .chatCleared)
        })
    }
    
    func test_45_tryClearChatNotOwningIt() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: false)
        
        try await asyncTest(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, "Only owner should be able to clear messages in a group chat - " + res.body.string) // Questionable
        })
    }
    
    func test_46_clearPersonalChat() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: users[0].id!, users: [current.id!], isPersonal: true)
        let message = try await service.makeMessages(for: chat.id!, authorId: users[0].id!, count: 1).first!
        
        try await app.test(.DELETE, "chats/\(chat.id!)/messages", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let chats = try await service.chats.repo.all(with: current.id!, fullInfo: false)
            XCTAssertEqual(chats.count, 1)
            let message = try await service.chats.repo.findMessage(id: message.id!)
            XCTAssertNil(message)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 2)
            XCTAssertTrue(sentNotifications[0].event == .chatCleared)
        })
    }
    
    func test_47_typingNotification() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: false)
        
        try await asyncTest(.POST, "chats/\(chat.id!)/notify", headers: .none, beforeRequest: { req in
            try req.content.encode(
                ChatNotificationRequest(name: "typing", data: ["deleted": true].jsonData())
            )
        }, afterResponse: { res in
            guard res.status == .ok else {
                return XCTFail("Error response: " + res.body.string)
            }
            XCTAssertEqual(res.status, .ok, res.body.string)
            let sentNotifications = await service.testNotificator.getSentNotifications()
            XCTAssertEqual(sentNotifications.count, 3)
            XCTAssertEqual(sentNotifications.filter { $0.event == .auxiliary }.count, 3)
            XCTAssertEqual(sentNotifications[0].source, "\(current.id!)")
            XCTAssertEqual(sentNotifications[0].payload?["name"] as? String, "typing")
            XCTAssertEqual(sentNotifications[0].payload?["data"] as? [String: Bool], ["deleted": true])
        })
    }
}
