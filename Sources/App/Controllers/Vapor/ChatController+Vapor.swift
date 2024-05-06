import Vapor

extension ChatController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped("chats").grouped(UserToken.authenticator())
        protected.get(use: chats)
        protected.post(use: createChat)
        protected.group(.id) { route in
            route.get(use: chat)
            route.put(use: updateChat)
            route.put("settings", use: updateChatSettings)
            
            route.post("users", use: addUsers)
            route.delete("users", use: deleteUsers)
            
            route.get("messages", use: messages)
            route.post("messages", use: postMessage)
            route.put("messages", use: updateMessage)
            route.put("messages", .messageId, use: updateMessage)
            route.put("messages", .messageId, "read", use: readMessage)
            route.delete("messages", .messageId, use: deleteMessage)
        }
    }
    
    func chats(_ req: Request) async throws -> [ChatInfo] {
        try await chats(with: req.currentUser().requireID(), fullInfo: req.fullInfo())
    }
    
    func chat(_ req: Request) async throws -> ChatInfo {
        try await chat(req.objectUUID(), with: req.currentUser().requireID())
    }
    
    func createChat(_ req: Request) async throws -> ChatInfo {
        try await createChat(with: req.content.decode(CreateChatRequest.self), by: req.currentUser().requireID())
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
        throw ServerError(.notImplemented)
    }
    
    func addUsers(_ req: Request) async throws -> ChatInfo {
        try await addUsers(to: req.objectUUID(),
                           users: req.content.decode(UpdateChatUsersRequest.self).users,
                           by: req.currentUser().requireID())
    }
    
    func deleteUsers(_ req: Request) async throws -> ChatInfo {
        try await deleteUsers(req.content.decode(UpdateChatUsersRequest.self).users,
                              from: req.objectUUID(),
                              by: req.currentUser().requireID())
    }
    
    func messages(_ req: Request) async throws -> [MessageInfo] {
        try await messages(from: req.objectUUID(),
                           for: req.currentUser().requireID(),
                           before: req.date(from: "before"),
                           count: req.query["count"] ?? 20)
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
        try await updateMessage(req.messageUUID(),
                                with: PostMessageRequest(text: "", fileSize: 0),
                                by: req.currentUser().requireID())
    }
}

struct CreateChatRequest: Content {
    var title: String?
    var participants: [UserID]
    var isPersonal: Bool
}

struct UpdateChatRequest: Content {
    var title: String?
    var isMuted: Bool?
    var isArchived: Bool?
    var isBlocked: Bool?
    var isRemovedOnDevice: Bool?
}

struct UpdateChatUsersRequest: Content {
    var users: [UserID]
}

struct PostMessageRequest: Content {
    var localId: UUID?
    var text: String?
    var fileType: String?
    var fileSize: Int64?
    var previewWidth: Int?
    var previewHeight: Int?
    var isVisible: Bool?
}
