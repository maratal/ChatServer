import Foundation

struct ChatController {
    
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo] {
        try await Repositories.chats.all(with: userId, fullInfo: fullInfo).map {
            ChatInfo(from: $0, fullInfo: fullInfo)
        }
    }
    
    func chat(_ id: UUID, with userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
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
        var chat = try await Repositories.chats.find(participantsKey: participantsKey, for: ownerId, isPersonal: info.isPersonal)
        
        if chat == nil {
            chat = Chat(title: info.title, ownerId: ownerId, isPersonal: info.isPersonal)
            try await Repositories.chats.save(chat!, with: users)
            let relation = try await Repositories.chats.findRelation(of: chat!.requireID(), userId: ownerId)!
            return ChatInfo(from: relation, fullInfo: true)
        }
        else {
            guard let relation = try await Repositories.chats.findRelation(of: chat!.requireID(), userId: ownerId), !relation.isBlocked else {
                throw ServerError(.forbidden)
            }
            return ChatInfo(from: relation, fullInfo: true)
        }
    }
    
    func updateChat(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId), !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        if relation.chat.isPersonal {
            throw ServerError(.badRequest, reason: "You can't update personal chat.")
        }
        if let title = update.title {
            relation.chat.title = title
        }
        try await Repositories.chats.save(relation.chat)
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func updateChatSettings(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServerError(.forbidden)
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
        try await Repositories.chats.save(relation.chat, with: Array(newUsers))
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func deleteUsers(_ users: [UserID], from id: UUID, by userId: UserID) async throws -> ChatInfo {
        guard users.count > 0 else {
            throw ServerError(.badRequest, reason: "No users to delete found.")
        }
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId), !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        let chat = relation.chat
        if chat.isPersonal {
            throw ServerError(.badRequest, reason: "You can't alter users in a personal chat.")
        }
        try await Repositories.chats.deleteUsers(users, from: chat)
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func deleteChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServerError(.forbidden)
        }
        let chat = relation.chat
        guard chat.isPersonal || chat.owner.id == userId else {
            throw ServerError(.forbidden, reason: "You can't delete this chat.")
        }
        if chat.isPersonal && relation.isBlocked {
            try await Repositories.chats.deleteMessages(from: chat)
        } else {
            try await Repositories.chats.delete(chat)
        }
    }
    
    func exitChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServerError(.forbidden)
        }
        guard !relation.chat.isPersonal else {
            throw ServerError(.badRequest)
        }
        try await Repositories.chats.deleteRelation(relation)
    }
    
    func clearChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId) else {
            throw ServerError(.forbidden)
        }
        let chat = relation.chat
        guard chat.isPersonal || chat.owner.id == userId else {
            throw ServerError(.forbidden, reason: "You can't clear this chat.")
        }
        try await Repositories.chats.deleteMessages(from: chat)
    }
    
    func messages(from id: UUID, for userId: UserID, before: Date?, count: Int) async throws -> [MessageInfo] {
        guard let relation = try await Repositories.chats.findRelation(of: id, userId: userId), !relation.isBlocked else {
            throw ServerError(.forbidden)
        }
        let messages = try await Repositories.chats.messages(from: id, before: before, count: count)
        return messages.map { $0.info() }
    }
    
    func postMessage(to id: UUID, with info: PostMessageRequest, by userId: UserID) async throws -> MessageInfo {
        let relations = try await Repositories.chats.findRelations(of: id)
        guard relations.count > 0 else {
            throw ServerError(.notFound)
        }
        guard let authorRelation = relations.ofUser(userId), !authorRelation.isBlocked else {
            throw ServerError(.forbidden)
        }
        guard info.localId != nil, info.text != nil || info.fileSize != nil else {
            throw ServerError(.badRequest, reason: "Malformed message data.")
        }
        if let text = info.text, (text.count == 0 || text.count > 2048) {
            throw ServerError(.badRequest, reason: "Message text should be between 1 and 2048 characters long.")
        }
        let message = Message(localId: info.localId.unsafelyUnwrapped,
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
        
        chat.$lastMessage.id = try message.requireID()
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
            throw ServerError(.forbidden)
        }
        if let text = update.text {
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
    
    func readMessage(_ id: UUID, by userId: UserID) async throws {
        guard let message = try await Repositories.chats.findMessage(id: id) else {
            throw ServerError(.notFound)
        }
        guard message.chat.users.contains(where: { $0.id == userId }) else {
            throw ServerError(.forbidden)
        }
        if message.reactions.first(where: { $0.user.id == userId && $0.badge == Reactions.seen.rawValue }) == nil {
            let reaction = Reaction(messageId: id, userId: userId, badge: .seen)
            try await Repositories.saveItem(reaction)
        }
    }
}
