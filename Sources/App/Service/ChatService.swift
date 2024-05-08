import Foundation

protocol ChatService {
    
    /// Returns all chats where `userId` is participant.
    /// Doesn't include chats where user is blocked and chats that were removed on users devices.
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo]
    
    /// Returns extended information about particular chat, where `userId` is participant.
    /// Includes a full list of other participants and their short info.
    func chat(_ id: UUID, with userId: UserID) async throws -> ChatInfo
    
    /// Creates chat from requested parameters.
    /// If chat with provided users (including `ownerId`) already exists, it will be returned.
    func createChat(with info: CreateChatRequest, by ownerId: UserID) async throws -> ChatInfo
    
    /// Updates properties of a multiuser chat (such as `title`) by a participant with `userId`. For personal chats returns an error.
    func updateChat(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo
    
    /// Updates personal settings of a chat (such as `isMuted`) by a participant with `userId`.
    func updateChatSettings(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo
    
    /// Adds users to a chat by a participant with `userId`.
    func addUsers(to id: UUID, users: [UserID], by userId: UserID) async throws -> ChatInfo
    
    /// Removes users from a chat by a participant with `userId`.
    func deleteUsers(_ users: [UserID], from id: UUID, by userId: UserID) async throws -> ChatInfo
    
    /// Deletes chat together with messages. If settings for a chat exist (such as `isBlocked`) only messages will be deleted.
    func deleteChat(_ id: UUID, by userId: UserID) async throws
    
    /// Blocks a participant with `targetId` from a chat by another participant with `userId`.
    func blockUser(_ targetId: UserID, in chatId: UUID, by userId: UserID) async throws
    
    /// Unblocks a participant with `targetId` from a chat by another participant with `userId`.
    func unblockUser(_ targetId: UserID, in chatId: UUID, by userId: UserID) async throws
    
    /// A participant of a multiuser chat uses this method to leave the chat. One can't exit personal chat (results in an error).
    func exitChat(_ id: UUID, by userId: UserID) async throws
    
    /// Deletes all messages in a chat.
    func clearChat(_ id: UUID, by userId: UserID) async throws
    
    /// Returns `count` messages from a chat before cirtain timestamp (limited to 50 by default).
    /// In case if `before` is omitted, returns `count` latest messages.
    func messages(from id: UUID, for userId: UserID, before: Date?, count: Int?) async throws -> [MessageInfo]
    
    /// Creates new message in a chat with `id` (if user with `userId` is not blocked).
    func postMessage(to id: UUID, with info: PostMessageRequest, by userId: UserID) async throws -> MessageInfo
    
    /// Edits message with `id` in a chat (if user with `userId` is not blocked).
    func updateMessage(_ id: UUID, with update: PostMessageRequest, by userId: UserID) async throws -> MessageInfo
    
    /// Deletes contents of a message with`id`.
    func deleteMessage(_ id: UUID, by userId: UserID) async throws -> MessageInfo
    
    /// Marks message with`id` as seen by the user with `userId`.
    func readMessage(_ id: UUID, by userId: UserID) async throws
}

extension ChatService {
    
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo] {
        try await Repositories.chats.all(with: userId, fullInfo: fullInfo).map {
            ChatInfo(from: $0, fullInfo: fullInfo)
        }
    }
    
    func chat(_ id: UUID, with userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServiceError(.notFound)
        }
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func createChat(with info: CreateChatRequest, by ownerId: UserID) async throws -> ChatInfo {
        let participants = info.participants.unique().filter { $0 != ownerId }
        guard participants.count > 0 else {
            throw ServiceError(.badRequest, reason: "New chat should contain at least one participant.")
        }

        let participantsKey = Set(participants + [ownerId]).participantsKey()
        var chat = try await Repositories.chats.find(participantsKey: participantsKey, for: ownerId, isPersonal: info.isPersonal)
        
        if chat == nil {
            chat = Chat(title: info.title, ownerId: ownerId, isPersonal: info.isPersonal)
            try await Repositories.chats.save(chat!, with: participants)
            let relation = try await Repositories.chats.findRelation(of: chat!.id!, userId: ownerId)!
            return ChatInfo(from: relation, fullInfo: true)
        }
        else {
            guard let relation = try await Repositories.chats.findRelation(of: chat!.id!, userId: ownerId) else {
                throw ServiceError(.notFound)
            }
            return ChatInfo(from: relation, fullInfo: true)
        }
    }
    
    func updateChat(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId), !relation.isBlocked else {
            throw ServiceError(.forbidden)
        }
        if relation.chat.isPersonal {
            throw ServiceError(.badRequest, reason: "You can't update personal chat.")
        }
        if let title = update.title {
            relation.chat.title = title
        }
        try await Repositories.chats.save(relation.chat)
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func updateChatSettings(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        if let isMuted = update.isMuted {
            relation.isMuted = isMuted
        }
        if let isArchived = update.isArchived {
            relation.isArchived = isArchived
        }
        if let isRemovedOnDevice = update.isRemovedOnDevice {
            relation.isRemovedOnDevice = isRemovedOnDevice
        }
        try await Repositories.chats.saveRelation(relation)
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func addUsers(to id: UUID, users: [UserID], by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId), !relation.isBlocked else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        if chat.isPersonal {
            throw ServiceError(.badRequest, reason: "You can't add users to a personal chat.")
        }
        let oldUsers = Set(chat.users.map { $0.id! })
        let newUsers = Set(users).subtracting(oldUsers)
        guard newUsers.count > 0 else {
            throw ServiceError(.badRequest, reason: "No users to add found.")
        }
        guard newUsers.count <= 10 else {
            throw ServiceError(.badRequest, reason: "To many users to add at once.")
        }
        try await Repositories.chats.save(relation.chat, with: Array(newUsers))
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func deleteUsers(_ users: [UserID], from id: UUID, by userId: UserID) async throws -> ChatInfo {
        guard users.count > 0 else {
            throw ServiceError(.badRequest, reason: "No users to delete found.")
        }
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId), !relation.isBlocked else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        if chat.isPersonal {
            throw ServiceError(.badRequest, reason: "You can't alter users in a personal chat.")
        }
        try await Repositories.chats.deleteUsers(users, from: chat)
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func deleteChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        guard chat.isPersonal || chat.owner.id == userId else {
            throw ServiceError(.forbidden, reason: "You can't delete this chat.")
        }
        if chat.isPersonal && relation.isBlocked {
            try await Repositories.chats.deleteMessages(from: chat)
        } else {
            try await Repositories.chats.delete(chat)
        }
    }
    
    private func setUser(_ targetId: UserID, in chatId: UUID, blocked: Bool, by userId: UserID) async throws {
        let relations = try await Repositories.chats.findRelations(of: chatId)
        guard relations.count > 0 else {
            throw ServiceError(.notFound)
        }
        guard let targetRelation = relations.ofUser(targetId) else {
            throw ServiceError(.notFound)
        }
        guard let blockerRelation = relations.ofUser(userId), !blockerRelation.isBlocked else {
            throw ServiceError(.forbidden)
        }
        targetRelation.isBlocked = blocked
        try await Repositories.chats.saveRelation(targetRelation)
    }
    
    func blockUser(_ targetId: UserID, in chatId: UUID, by userId: UserID) async throws {
        try await setUser(targetId, in: chatId, blocked: true, by: userId)
    }
    
    func unblockUser(_ targetId: UserID, in chatId: UUID, by userId: UserID) async throws {
        try await setUser(targetId, in: chatId, blocked: false, by: userId)
    }
    
    func exitChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        guard !relation.chat.isPersonal else {
            throw ServiceError(.badRequest)
        }
        try await Repositories.chats.deleteRelation(relation)
    }
    
    func clearChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        guard chat.isPersonal || chat.owner.id == userId else {
            throw ServiceError(.forbidden, reason: "You can't clear this chat.")
        }
        try await Repositories.chats.deleteMessages(from: chat)
    }
    
    func messages(from id: UUID, for userId: UserID, before: Date?, count: Int?) async throws -> [MessageInfo] {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId), !relation.isBlocked else {
            throw ServiceError(.forbidden)
        }
        let messages = try await Repositories.chats.messages(from: id, before: before, count: count ?? 50)
        return messages.map { $0.info() }
    }
    
    func postMessage(to id: UUID, with info: PostMessageRequest, by userId: UserID) async throws -> MessageInfo {
        let relations = try await Repositories.chats.findRelations(of: id)
        guard relations.count > 0 else {
            throw ServiceError(.notFound)
        }
        guard let authorRelation = relations.ofUser(userId), !authorRelation.isBlocked else {
            throw ServiceError(.forbidden)
        }
        guard info.localId != nil, info.text != nil || info.fileSize != nil else {
            throw ServiceError(.badRequest, reason: "Malformed message data.")
        }
        if let text = info.text, (text.count == 0 || text.count > 2048) {
            throw ServiceError(.badRequest, reason: "Message text should be between 1 and 2048 characters long.")
        }
        let message = Message(localId: info.localId!,
                              authorId: userId,
                              chatId: id,
                              text: info.text,
                              fileType: info.fileType,
                              fileSize: info.fileSize,
                              previewWidth: info.previewWidth,
                              previewHeight: info.previewHeight,
                              isVisible: info.isVisible ?? true)
        
        try await Repositories.chats.saveMessage(message)
        
        let chat = authorRelation.chat
        
        chat.$lastMessage.id = message.id!
        authorRelation.isArchived = false
        authorRelation.isRemovedOnDevice = false
        
        var itemsToSave: [any RepositoryItem] = [chat, authorRelation]
        
        if chat.isPersonal {
            if let recipientRelation = relations.ofUserOtherThen(userId), recipientRelation.isRemovedOnDevice {
                recipientRelation.isRemovedOnDevice = false
                itemsToSave.append(recipientRelation)
            }
        }
        
        try await Repositories.saveAll(itemsToSave)
        
        return message.info()
    }
    
    func updateMessage(_ id: UUID, with update: PostMessageRequest, by userId: UserID) async throws -> MessageInfo {
        guard let message = try await Repositories.chats.findMessage(id: id), message.author.id == userId else {
            throw ServiceError(.forbidden)
        }
        guard let authorRelation = message.chat.relations.ofUser(userId), !authorRelation.isBlocked else {
            throw ServiceError(.forbidden)
        }
        if let text = update.text {
            guard message.text != "" else {
                throw ServiceError(.badRequest, reason: "You can't edit deleted message.")
            }
            message.text = text
            message.editedAt = Date()
        }
        if let fileType = update.fileType {
            message.fileType = fileType
        }
        if let fileSize = update.fileSize {
            message.fileSize = fileSize
        }
        if let isVisible = update.isVisible {
            message.isVisible = isVisible
        }
        try await Repositories.chats.saveMessage(message)
        return message.info()
    }
    
    func deleteMessage(_ id: UUID, by userId: UserID) async throws -> MessageInfo {
        guard let message = try await Repositories.chats.findMessage(id: id), message.author.id == userId else {
            throw ServiceError(.forbidden)
        }
        message.text = ""
        message.fileSize = 0
        message.editedAt = Date()
        try await Repositories.chats.saveMessage(message)
        return message.info()
    }
    
    func readMessage(_ id: UUID, by userId: UserID) async throws {
        guard let message = try await Repositories.chats.findMessage(id: id) else {
            throw ServiceError(.notFound)
        }
        guard message.chat.relations.contains(where: { $0.$user.id == userId }) else {
            throw ServiceError(.forbidden)
        }
        if message.reactions.first(where: { $0.user.id == userId && $0.badge == Reactions.seen.rawValue }) == nil {
            let reaction = Reaction(messageId: id, userId: userId, badge: .seen)
            try await Repositories.saveItem(reaction)
        }
    }
}
