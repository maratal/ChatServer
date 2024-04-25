import Foundation

struct ChatController {
    
    func chats(of user: User) async throws -> [ChatInfo] {
        throw ServerError(.notImplemented)
    }
}
