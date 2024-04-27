import Vapor

extension ChatController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped("chats").grouped(UserToken.authenticator())
        protected.get(use: chats)
        protected.post(use: createChat)
        protected.group(Request.Parameter.id.pathComponent) { route in
            route.get(use: chat)
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
        throw ServerError(.notImplemented)
    }
    
    func updateChatSettings(_ req: Request) async throws -> HTTPStatus {
        throw ServerError(.notImplemented)
    }
    
    func deleteChat(_ req: Request) async throws -> HTTPStatus {
        throw ServerError(.notImplemented)
    }
    
    func addUsers(_ req: Request) async throws -> ChatInfo {
        throw ServerError(.notImplemented)
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
}
