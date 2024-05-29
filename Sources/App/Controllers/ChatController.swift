import Vapor

struct ChatController: ChatService, RouteCollection {
    
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
        try await chats(with: req.currentUser().requireID(), fullInfo: req.fullInfo())
    }
    
    func chat(_ req: Request) async throws -> ChatInfo {
        try await chat(req.objectUUID(), with: req.currentUser().requireID())
    }
    
    func createChat(_ req: Request) async throws -> ChatInfo {
        try await createChat(with: req.content.decode(CreateChatRequest.self),
                             by: req.currentUser().requireID())
    }
    
    func updateChat(_ req: Request) async throws -> ChatInfo {
        try await updateChat(req.objectUUID(),
                             with: req.content.decode(UpdateChatRequest.self),
                             by: req.currentUser().requireID())
    }
    
    func updateChatSettings(_ req: Request) async throws -> ChatInfo {
        try await updateChatSettings(req.objectUUID(),
                                     with: req.content.decode(UpdateChatRequest.self),
                                     by: req.currentUser().requireID())
    }
    
    func deleteChat(_ req: Request) async throws -> HTTPStatus {
        try await deleteChat(req.objectUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func exitChat(_ req: Request) async throws -> HTTPStatus {
        try await exitChat(req.objectUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func clearChat(_ req: Request) async throws -> HTTPStatus {
        try await clearChat(req.objectUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func addUsers(_ req: Request) async throws -> ChatInfo {
        try await addUsers(to: req.objectUUID(),
                           users: req.content.decode(UpdateChatUsersRequest.self).users,
                           by: req.currentUser().requireID())
    }
    
    func removeUsers(_ req: Request) async throws -> ChatInfo {
        try await removeUsers(req.content.decode(UpdateChatUsersRequest.self).users,
                              from: req.objectUUID(),
                              by: req.currentUser().requireID())
    }
    
    func blockUserInChat(_ req: Request) async throws -> HTTPStatus {
        try await blockUser(req.userID(),
                            in: req.objectUUID(),
                            by: req.currentUser().requireID())
        return .ok
    }
    
    func unblockUserInChat(_ req: Request) async throws -> HTTPStatus {
        try await unblockUser(req.userID(),
                              in: req.objectUUID(),
                              by: req.currentUser().requireID())
        return .ok
    }
    
    func messages(_ req: Request) async throws -> [MessageInfo] {
        try await messages(from: req.objectUUID(),
                           for: req.currentUser().requireID(),
                           before: req.date(from: "before"),
                           count: req.query["count"])
    }
    
    func postMessage(_ req: Request) async throws -> MessageInfo {
        try await postMessage(to: req.objectUUID(),
                              with: req.content.decode(PostMessageRequest.self),
                              by: req.currentUser().requireID())
    }
    
    func updateMessage(_ req: Request) async throws -> MessageInfo {
        try await updateMessage(req.messageUUID(),
                                with: req.content.decode(PostMessageRequest.self),
                                by: req.currentUser().requireID())
    }
    
    func readMessage(_ req: Request) async throws -> HTTPStatus {
        try await readMessage(req.messageUUID(), by: req.currentUser().requireID())
        return .ok
    }
    
    func deleteMessage(_ req: Request) async throws -> MessageInfo {
        try await deleteMessage(req.messageUUID(), by: req.currentUser().requireID())
    }
}
