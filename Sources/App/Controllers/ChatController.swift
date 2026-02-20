/**
 * This controller object just redirects everything to the appropriate service actor. Do not add any logic here.
 */
import Vapor

struct ChatController: RouteCollection {

    let service: ChatServiceProtocol
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped("chats").grouped(DeviceSession.authenticator())
        protected.get(use: chats)
        protected.post(use: createChat)
        protected.group(.id) { route in
            route.get(use: chat)
            route.put(use: updateChat)
            route.put("settings", use: updateChatSettings)
            route.delete(use: deleteChat)
            route.delete("me", use: exitChat)
            route.put("block", use: blockChat)
            route.put("unblock", use: unblockChat)
            
            route.post("users", use: addUsers)
            route.delete("users", use: removeUsers)
            route.put("users", .userId, "block", use: blockUserInChat)
            route.put("users", .userId, "unblock", use: unblockUserInChat)
            route.get("users", "blocked", use: blockedUsersInChat)
            
            route.get("messages", use: messages)
            route.post("messages", use: postMessage)
            route.put("messages", .messageId, use: updateMessage)
            route.put("messages", .messageId, "read", use: readMessage)
            route.delete("messages", .messageId, use: deleteMessage)
            route.delete("messages", use: clearChat)
            
            route.post("images", use: addChatImage)
            route.delete("images", .id, use: deleteChatImage)
            
            route.post("notify", use: notifyChat)
        }
    }
    
    func chats(_ req: Request) async throws -> [ChatInfo] {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).chats(with: currentUser.requireID(), fullInfo: req.fullInfo())
    }
    
    func chat(_ req: Request) async throws -> ChatInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).chat(req.objectUUID(), with: currentUser.requireID())
    }
    
    func createChat(_ req: Request) async throws -> ChatInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).createChat(with: req.content.decode(CreateChatRequest.self),
                                                              by: currentUser.requireID())
    }
    
    func updateChat(_ req: Request) async throws -> ChatInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).updateChat(req.objectUUID(),
                                                              with: req.content.decode(UpdateChatRequest.self),
                                                              by: currentUser.requireID())
    }
    
    func updateChatSettings(_ req: Request) async throws -> ChatInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).updateChatSettings(req.objectUUID(),
                                                                      with: req.content.decode(UpdateChatRequest.self),
                                                                      by: currentUser.requireID())
    }
    
    func addChatImage(_ req: Request) async throws -> ChatInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).addChatImage(req.objectUUID(),
                                                                with: req.content.decode(UpdateChatRequest.self),
                                                                by: currentUser.requireID())
    }
    
    func deleteChatImage(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).deleteChatImage(req.objectUUID(), by: currentUser.requireID())
        return .ok
    }
    
    func deleteChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).deleteChat(req.objectUUID(), by: currentUser.requireID())
        return .ok
    }
    
    func exitChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).exitChat(req.objectUUID())
        return .ok
    }
    
    func clearChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).clearChat(req.objectUUID(), by: currentUser.requireID())
        return .ok
    }
    
    func addUsers(_ req: Request) async throws -> ChatInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).addUsers(to: req.objectUUID(),
                                                            users: req.content.decode(UpdateChatUsersRequest.self).users,
                                                            by: currentUser.requireID())
    }
    
    func removeUsers(_ req: Request) async throws -> ChatInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).removeUsers(req.content.decode(UpdateChatUsersRequest.self).users,
                                                               from: req.objectUUID(),
                                                               by: currentUser.requireID())
    }
    
    func blockChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).blockChat(req.objectUUID(),
                                                      by: currentUser.requireID())
        return .ok
    }
    
    func unblockChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).unblockChat(req.objectUUID(),
                                                        by: currentUser.requireID())
        return .ok
    }
    
    func blockUserInChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).blockUser(req.userID(),
                                                      in: req.objectUUID(),
                                                      by: currentUser.requireID())
        return .ok
    }
    
    func unblockUserInChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).unblockUser(req.userID(),
                                                        in: req.objectUUID(),
                                                        by: currentUser.requireID())
        return .ok
    }
    
    func blockedUsersInChat(_ req: Request) async throws -> [UserInfo] {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).blockedUsersInChat(req.objectUUID(),
                                                                      with: currentUser.requireID())
    }
    
    func messages(_ req: Request) async throws -> [MessageInfo] {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).messages(from: req.objectUUID(),
                                                            for: currentUser.requireID(),
                                                            before: req.idFromQuery("before"),
                                                            count: req.query["count"])
    }
    
    func postMessage(_ req: Request) async throws -> MessageInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).postMessage(to: req.objectUUID(),
                                                               with: req.content.decode(PostMessageRequest.self),
                                                               by: currentUser.requireID())
    }
    
    func updateMessage(_ req: Request) async throws -> MessageInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).updateMessage(req.messageID(),
                                                                 with: req.content.decode(UpdateMessageRequest.self),
                                                                 by: currentUser.requireID())
    }
    
    func readMessage(_ req: Request) async throws -> MessageInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).readMessage(req.messageID(), by: currentUser.requireID())
    }
    
    func deleteMessage(_ req: Request) async throws -> MessageInfo {
        let currentUser = try await req.requireCurrentUser()
        return try await service.with(currentUser).deleteMessage(req.messageID(), by: currentUser.requireID())
    }
    
    func notifyChat(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).notifyChat(req.objectUUID(),
                                                       with: req.content.decode(ChatNotificationRequest.self),
                                                       from: currentUser.requireID())
        return .ok
    }
}
