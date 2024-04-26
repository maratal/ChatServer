import Foundation

struct ChatController {
    
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo] {
        try await Repositories.users.chats(with: userId, fullInfo: fullInfo).map {
            ChatInfo(from: $0, fullInfo: fullInfo)
        }
    }
    
    func chat(_ id: UUID, with userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.users.findChat(id, for: userId) else {
            throw ServerError(.notFound)
        }
        guard !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        return ChatInfo(from: relation, fullInfo: true)
    }
}
