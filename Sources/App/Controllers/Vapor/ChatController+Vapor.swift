import Vapor

extension ChatController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped("chats").grouped(UserToken.authenticator())
        protected.get(use: chats)
        protected.post(use: createChat)
        protected.group(Request.Parameter.id.pathComponent) { route in
            route.get(use: chat)
            route.put(use: updateChat)
            route.put("settings", use: updateChatSettings)
            route.post("users", use: addUsers)
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
    
    func deleteUser(_ req: Request) async throws -> HTTPStatus {
        throw ServerError(.notImplemented)
    }
    
    func messages(_ req: Request) async throws -> [MessageInfo] {
        throw ServerError(.notImplemented)
    }
    
    func postMessage(_ req: Request) async throws -> MessageInfo {
        throw ServerError(.notImplemented)
    }
    
    func updateMessage(_ req: Request) async throws -> MessageInfo {
        throw ServerError(.notImplemented)
    }
    
    func readMessage(_ req: Request) async throws -> MessageInfo {
        throw ServerError(.notImplemented)
    }
    
    func deleteMessage(_ req: Request) async throws -> HTTPStatus {
        throw ServerError(.notImplemented)
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
}

struct UpdateChatUsersRequest: Content {
    var users: [UserID]
}
