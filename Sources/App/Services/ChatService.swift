import Foundation

protocol ChatServiceProtocol {
    
    /// Repository for storing and fetching chats data.
    var repo: ChatsRepository { get }
    
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
    func removeUsers(_ users: [UserID], from id: UUID, by userId: UserID) async throws -> ChatInfo
    
    /// Deletes chat locally and all of its messages from the server.
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

final class ChatService: ChatServiceProtocol {
    
    var repo: ChatsRepository
    
    init(repo: ChatsRepository) {
        self.repo = repo
    }
    
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo] {
        try await repo.all(with: userId, fullInfo: fullInfo).map {
            ChatInfo(from: $0, fullInfo: fullInfo)
        }
    }
    
    func chat(_ id: UUID, with userId: UserID) async throws -> ChatInfo {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
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
        var chat = try await repo.find(participantsKey: participantsKey, for: ownerId, isPersonal: info.isPersonal)
        
        if chat == nil {
            chat = Chat(title: info.title, ownerId: ownerId, isPersonal: info.isPersonal)
            try await repo.save(chat!, with: participants)
            let relation = try await repo.findRelation(of: chat!.id!, userId: ownerId)!
            return ChatInfo(from: relation, fullInfo: true)
        }
        else {
            guard let relation = try await repo.findRelation(of: chat!.id!, userId: ownerId) else {
                throw ServiceError(.notFound)
            }
            return ChatInfo(from: relation, fullInfo: true)
        }
    }
    
    func updateChat(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await repo.findRelation(of: id, userId: userId), !relation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        if relation.chat.isPersonal {
            throw ServiceError(.badRequest, reason: "You can't update personal chat.")
        }
        if let title = update.title {
            chat.title = title
        }
        try await repo.save(chat)
        let info = ChatInfo(from: relation, fullInfo: false)
        try await Service.notificator.notify(chat: chat, with: info, about: .chatUpdate, from: relation.user)
        return info
    }
    
    func updateChatSettings(_ id: UUID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
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
        try await repo.saveRelation(relation)
        return ChatInfo(from: relation, fullInfo: false)
    }
    
    func addUsers(to id: UUID, users: [UserID], by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await repo.findRelation(of: id, userId: userId), !relation.isUserBlocked else {
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
        try await repo.save(relation.chat, with: Array(newUsers))
        let addedUsers = chat.users.filter { newUsers.contains($0.id!) }.map { $0.info() }
        let info = ChatInfo(from: relation, addedUsers: addedUsers, removedUsers: nil)
        try await Service.notificator.notify(chat: chat, with: info, about: .addedUsers, from: relation.user)
        return info
    }
    
    func removeUsers(_ users: [UserID], from id: UUID, by userId: UserID) async throws -> ChatInfo {
        guard users.count > 0 else {
            throw ServiceError(.badRequest, reason: "No users to remove found.")
        }
        let relations = try await repo.findRelations(of: id)
        guard let relation = relations.ofUser(userId), !relation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        if chat.isPersonal {
            throw ServiceError(.badRequest, reason: "You can't alter users in a personal chat.")
        }
        let usersToNotRemove = relations.filter { $0.isChatBlocked }.map { $0.$user.id }
        let usersToRemove = Array(Set(users).subtracting(Set(usersToNotRemove)))
        let usersCache = chat.users
        let usersBefore = chat.users.map { $0.id! }
        try await repo.removeUsers(usersToRemove, from: chat)
        let usersAfter = chat.users.map { $0.id! }
        let removedUsersSet = Set(usersBefore).subtracting(Set(usersAfter))
        let removedUsers = usersCache.filter { removedUsersSet.contains($0.id!) }.map { $0.info() }
        let info = ChatInfo(from: relation, addedUsers: nil, removedUsers: removedUsers)
        try await Service.notificator.notify(chat: chat, with: info, about: .removedUsers, from: relation.user)
        return info
    }
    
    func deleteChat(_ id: UUID, by userId: UserID) async throws {
        let relations = try await repo.findRelations(of: id)
        guard relations.count > 0 else {
            throw ServiceError(.notFound)
        }
        guard let sourceRelation = relations.ofUser(userId) else {
            throw ServiceError(.notFound)
        }
        let chat = sourceRelation.chat
        guard chat.isPersonal || chat.owner.id == userId else {
            throw ServiceError(.forbidden, reason: "You can't delete this chat.")
        }
        try await repo.deleteMessages(from: chat)
        var itemsToSave = [ChatRelation]()
        for relation in relations {
            if !relation.isChatBlocked { // should be visible locally for unblocking
                relation.isRemovedOnDevice = true
                itemsToSave.append(relation)
            }
        }
        try await Service.saveAll(itemsToSave)
        try await Service.notificator.notify(chat: chat, with: nil, about: .chatDeleted, from: sourceRelation.user)
    }
    
    private func setUser(_ targetId: UserID, in chatId: UUID, blocked: Bool, by userId: UserID) async throws {
        let relations = try await repo.findRelations(of: chatId)
        guard relations.count > 0 else {
            throw ServiceError(.notFound)
        }
        guard let targetRelation = relations.ofUser(targetId) else {
            throw ServiceError(.notFound)
        }
        guard let blockerRelation = relations.ofUser(userId), !blockerRelation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        targetRelation.isUserBlocked = blocked
        try await repo.saveRelation(targetRelation)
    }
    
    func blockUser(_ targetId: UserID, in chatId: UUID, by userId: UserID) async throws {
        try await setUser(targetId, in: chatId, blocked: true, by: userId)
    }
    
    func unblockUser(_ targetId: UserID, in chatId: UUID, by userId: UserID) async throws {
        try await setUser(targetId, in: chatId, blocked: false, by: userId)
    }
    
    func exitChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        guard !relation.chat.isPersonal else {
            throw ServiceError(.badRequest)
        }
        try await repo.deleteRelation(relation)
    }
    
    func clearChat(_ id: UUID, by userId: UserID) async throws {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        guard chat.isPersonal || chat.owner.id == userId else {
            throw ServiceError(.forbidden, reason: "You can't clear this chat.")
        }
        try await repo.deleteMessages(from: chat)
        try await Service.notificator.notify(chat: chat, with: nil, about: .chatCleared, from: relation.user)
    }
    
    func messages(from id: UUID, for userId: UserID, before: Date?, count: Int?) async throws -> [MessageInfo] {
        guard let relation = try await repo.findRelation(of: id, userId: userId), !relation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        let messages = try await repo.messages(from: id, before: before, count: count ?? 50)
        return messages.map { $0.info() }
    }
    
    func postMessage(to id: UUID, with info: PostMessageRequest, by userId: UserID) async throws -> MessageInfo {
        let relations = try await repo.findRelations(of: id)
        guard relations.count > 0 else {
            throw ServiceError(.notFound)
        }
        guard let authorRelation = relations.ofUser(userId), !authorRelation.isUserBlocked else {
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
        
        try await repo.saveMessage(message)
        
        let chat = authorRelation.chat
        
        chat.$lastMessage.id = message.id!
        
        var itemsToSave: [any RepositoryItem] = [chat]
        
        if authorRelation.isArchived || authorRelation.isRemovedOnDevice {
            authorRelation.isArchived = false
            authorRelation.isRemovedOnDevice = false
            itemsToSave.append(authorRelation)
        }
        
        if chat.isPersonal {
            if let recipientRelation = relations.ofUserOtherThen(userId), recipientRelation.isRemovedOnDevice {
                recipientRelation.isRemovedOnDevice = false
                itemsToSave.append(recipientRelation)
            }
        }
        
        try await Service.saveAll(itemsToSave)
        
        let info = message.info()
        try await Service.notificator.notify(chat: chat, with: info, about: .message, from: authorRelation.user)
        return info
    }
    
    func updateMessage(_ id: UUID, with update: PostMessageRequest, by userId: UserID) async throws -> MessageInfo {
        guard let message = try await repo.findMessage(id: id), message.author.id == userId else {
            throw ServiceError(.forbidden)
        }
        guard let authorRelation = message.chat.relations.ofUser(userId), !authorRelation.isUserBlocked else {
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
        try await repo.saveMessage(message)
        
        let info = message.info()
        try await Service.notificator.notify(chat: message.chat, with: info, about: .messageUpdate, from: authorRelation.user)
        return info
    }
    
    func deleteMessage(_ id: UUID, by userId: UserID) async throws -> MessageInfo {
        guard let message = try await repo.findMessage(id: id), message.author.id == userId else {
            throw ServiceError(.forbidden)
        }
        message.text = ""
        message.fileSize = 0
        message.editedAt = Date()
        try await repo.saveMessage(message)
        
        let info = message.info()
        try await Service.notificator.notify(chat: message.chat, with: info, about: .messageUpdate, from: message.author)
        return info
    }
    
    func readMessage(_ id: UUID, by userId: UserID) async throws {
        guard let message = try await repo.findMessage(id: id) else {
            throw ServiceError(.notFound)
        }
        guard let readerRelation = message.chat.relations.ofUser(userId) else {
            throw ServiceError(.forbidden)
        }
        if message.readMarks.first(where: { $0.user.id == userId }) == nil {
            let readMark = ReadMark(messageId: id, userId: userId)
            try await Service.saveItem(readMark)
            let info = message.info()
            try await Service.notificator.notify(chat: message.chat, with: info, about: .messageUpdate, from: readerRelation.user)
        }
    }
}
