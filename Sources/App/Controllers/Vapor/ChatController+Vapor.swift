import Vapor

extension ChatController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let route = routes.grouped("chats").grouped(UserToken.authenticator())
        route.get("chats", use: chats)
    }
    
    func chats(_ req: Request) async throws -> [ChatInfo] {
        try await chats(of: try await req.currentUser())
    }
    
    func chat(_ req: Request) async throws -> ChatInfo {
        throw ServerError(.notImplemented)
    }
    
    func createChat(_ req: Request) async throws -> ChatInfo {
        throw ServerError(.notImplemented)
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
