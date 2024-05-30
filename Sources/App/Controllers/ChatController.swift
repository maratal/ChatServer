import Vapor

struct ChatController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped("chats").grouped(DeviceSession.authenticator())
        protected.get(use: chats)
        protected.post(use: createChat)
        protected.group(.id) { route in
            route.get(use: chat)
            route.put(use: updateChat)
            route.put("settings", use: updateChatSettings)
            route.delete(use: deleteChat)
            route.delete("exit", use: exitChat)
            
            route.post("users", use: addUsers)
            route.delete("users", use: removeUsers)
            route.put("users", .userId, "block", use: blockUserInChat)
            route.put("users", .userId, "unblock", use: unblockUserInChat)
            
            route.get("messages", use: messages)
            route.post("messages", use: postMessage)
            route.put("messages", .messageId, use: updateMessage)
            route.put("messages", .messageId, "read", use: readMessage)
            route.delete("messages", .messageId, use: deleteMessage)
            route.delete("messages", use: clearChat)
        }
    }
    
    func chats(_ req: Request) async throws -> [ChatInfo] {
        try await Service.chats.chats(with: req.currentUser().requireID(), fullInfo: req.fullInfo())
    }
    
    func chat(_ req: Request) async throws -> ChatInfo {
        try await Service.chats.chat(req.objectUUID(), with: req.currentUser().requireID())
    }
    
    func createChat(_ req: Request) async throws -> ChatInfo {
        try await Service.chats.createChat(with: req.content.decode(CreateChatRequest.self),
                                           by: req.currentUser().requireID())
    }
    
    func updateChat(_ req: Request) async throws -> ChatInfo {
        try await Service.chats.updateChat(req.objectUUID(),
                                           with: req.content.decode(UpdateChatRequest.self),
                                           by: req.currentUser().requireID())
    }
    
    func updateChatSettings(_ req: Request) async throws -> ChatInfo {
        try await Service.chats.updateChatSettings(req.objectUUID(),
                                                   with: req.content.decode(UpdateChatRequest.self),
                                                   by: req.currentUser().requireID())
    }
    
    func deleteChat(_ req: Request) async throws -> HTTPStatus {
        try await Service.chats.deleteChat(req.objectUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func exitChat(_ req: Request) async throws -> HTTPStatus {
        try await Service.chats.exitChat(req.objectUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func clearChat(_ req: Request) async throws -> HTTPStatus {
        try await Service.chats.clearChat(req.objectUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func addUsers(_ req: Request) async throws -> ChatInfo {
        try await Service.chats.addUsers(to: req.objectUUID(),
                                         users: req.content.decode(UpdateChatUsersRequest.self).users,
                                         by: req.currentUser().requireID())
    }
    
    func removeUsers(_ req: Request) async throws -> ChatInfo {
        try await Service.chats.removeUsers(req.content.decode(UpdateChatUsersRequest.self).users,
                                            from: req.objectUUID(),
                                            by: req.currentUser().requireID())
    }
    
    func blockUserInChat(_ req: Request) async throws -> HTTPStatus {
        try await Service.chats.blockUser(req.userID(),
                                          in: req.objectUUID(),
                                          by: req.currentUser().requireID())
        return .ok
    }
    
    func unblockUserInChat(_ req: Request) async throws -> HTTPStatus {
        try await Service.chats.unblockUser(req.userID(),
                                            in: req.objectUUID(),
                                            by: req.currentUser().requireID())
        return .ok
    }
    
    func messages(_ req: Request) async throws -> [MessageInfo] {
        try await Service.chats.messages(from: req.objectUUID(),
                                         for: req.currentUser().requireID(),
                                         before: req.date(from: "before"),
                                         count: req.query["count"])
    }
    
    func postMessage(_ req: Request) async throws -> MessageInfo {
        try await Service.chats.postMessage(to: req.objectUUID(),
                                            with: req.content.decode(PostMessageRequest.self),
                                            by: req.currentUser().requireID())
    }
    
    func updateMessage(_ req: Request) async throws -> MessageInfo {
        try await Service.chats.updateMessage(req.messageUUID(),
                                              with: req.content.decode(PostMessageRequest.self),
                                              by: req.currentUser().requireID())
    }
    
    func readMessage(_ req: Request) async throws -> HTTPStatus {
        try await Service.chats.readMessage(req.messageUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func deleteMessage(_ req: Request) async throws -> MessageInfo {
        try await Service.chats.deleteMessage(req.messageUUID(), by: req.currentUser().requireID())
    }
}
