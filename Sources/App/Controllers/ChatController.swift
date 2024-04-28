import Foundation

struct ChatController {
    
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo] {
        try await Repositories.users.chats(with: userId, fullInfo: fullInfo).map {
            ChatInfo(from: $0, fullInfo: fullInfo)
        }
    }
    
    func chat(_ id: UUID, with userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.users.findChatRelation(id, for: userId) else {
            throw ServerError(.notFound)
        }
        guard !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func createChat(with info: CreateChatRequest, by ownerId: UserID) async throws -> ChatInfo {
        let users = Array(Set(info.participants.filter { $0 != ownerId }))
        guard users.count > 0 else {
            throw ServerError(.badRequest, reason: "New chat should contain at least one participant.")
        }

        let participantsKey = (users + [ownerId]).participantsKey()
        var chat = try await Repositories.users.findChat(participantsKey: participantsKey, for: ownerId, isPersonal: users.count == 1)
        
        if chat == nil {
            chat = Chat(ownerId: ownerId, participantsKey: participantsKey)
            try await Repositories.users.saveChat(chat!, with: users + [ownerId])
            let relation = try await Repositories.users.findChatRelation(chat!.requireID(), for: ownerId)!
            return ChatInfo(from: relation, fullInfo: true)
        }
        else {
            guard let relation = try await Repositories.users.findChatRelation(chat!.requireID(), for: ownerId), !relation.isBlocked else {
                throw ServerError(.forbidden)
            }
            return ChatInfo(from: relation, fullInfo: true)
        }
    }
    
    func updateChat(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.users.findChatRelation(id, for: userId), !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        if relation.chat.isPersonal {
            throw ServerError(.badRequest, reason: "You can't update personal chat.")
        }
        if let title = update.title {
            relation.chat.title = title
        }
        try await Repositories.users.saveChat(relation.chat, with: nil)
        return ChatInfo(from: relation, fullInfo: true)
    }
}
