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

        let participantsKey = Set(users + [ownerId]).participantsKey()
        var chat = try await Repositories.users.findChat(participantsKey: participantsKey, for: ownerId, isPersonal: info.isPersonal)
        
        if chat == nil {
            chat = Chat(title: info.title, ownerId: ownerId, isPersonal: info.isPersonal)
            try await Repositories.users.saveChat(chat!, with: users)
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
    
    func updateChatSettings(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.users.findChatRelation(id, for: userId), !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        if let isMuted = update.isMuted {
            relation.isMuted = isMuted
        }
        if let isArchived = update.isArchived {
            relation.isArchived = isArchived
        }
        if let isBlocked = update.isBlocked {
            relation.isBlocked = isBlocked
        }
        try await Repositories.users.saveChatRelation(relation)
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func addUsers(to id: UUID, users: [UserID], by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.users.findChatRelation(id, for: userId), !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        let chat = relation.chat
        if chat.isPersonal {
            throw ServerError(.badRequest, reason: "You can't add users to a personal chat.")
        }
        let oldUsers = Set(chat.users.map { $0.id! })
        let newUsers = Set(users).subtracting(oldUsers)
        guard newUsers.count > 0 else {
            throw ServerError(.badRequest, reason: "No users to add found.")
        }
        guard newUsers.count <= 10 else {
            throw ServerError(.badRequest, reason: "To many users to add at once.")
        }
        try await Repositories.users.saveChat(relation.chat, with: Array(newUsers))
        return ChatInfo(from: relation, fullInfo: true)
    }
}
