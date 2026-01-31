/**
 * This file abstracts pure chat logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol ChatServiceProtocol: LoggedIn {

    /// Returns all chats where `userId` is participant.
    /// Doesn't include chats where user is blocked and chats that were removed on users devices.
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo]
    
    /// Returns extended information about particular chat, where `userId` is participant.
    /// Includes a full list of other participants and their short info.
    func chat(_ id: ChatID, with userId: UserID) async throws -> ChatInfo
    
    /// Creates chat from requested parameters.
    /// If chat with provided users (including `ownerId`) already exists, it will be returned.
    func createChat(with info: CreateChatRequest, by ownerId: UserID) async throws -> ChatInfo
    
    /// Updates properties of a multiuser chat (such as `title`) by a participant with `userId`. For personal chats returns an error.
    func updateChat(_ id: ChatID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo
    
    /// Updates personal settings of a chat (such as `isMuted`) by a participant with `userId`.
    func updateChatSettings(_ id: ChatID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo
    
    /// Adds users to a chat by a participant with `userId`.
    func addUsers(to id: ChatID, users: [UserID], by userId: UserID) async throws -> ChatInfo
    
    /// Removes users from a chat by a participant with `userId`.
    func removeUsers(_ users: [UserID], from id: ChatID, by userId: UserID) async throws -> ChatInfo
    
    /// Deletes chat locally and all of its messages from the server.
    func deleteChat(_ id: ChatID, by userId: UserID) async throws
    
    /// Blocks a participant with `targetId` from a chat by another participant with `userId`.
    func blockUser(_ targetId: UserID, in chatId: ChatID, by userId: UserID) async throws
    
    /// Unblocks a participant with `targetId` from a chat by another participant with `userId`.
    func unblockUser(_ targetId: UserID, in chatId: ChatID, by userId: UserID) async throws
    
    /// Blocks a chat with `id` by a participant with `userId` to avoid re-appearing of the chat on the user's device or being removed from and then re-added.
    /// In personal chats this setting doesn't matter, because sender's `isUserBlocked` is checked first, preventing posting messages to the chat.
    func blockChat(_ id: ChatID, by userId: UserID) async throws
    
    /// Unblocks a chat with `id` by a participant with `userId`.
    func unblockChat(_ id: ChatID, by userId: UserID) async throws
    
    /// A participant of a multiuser chat uses this method to leave the chat. One can't exit personal chat (results in an error).
    func exitChat(_ id: ChatID, by userId: UserID) async throws
    
    /// Deletes all messages in a chat.
    func clearChat(_ id: ChatID, by userId: UserID) async throws
    
    /// Returns `count` messages from a chat before certain message (limited to 50 by default).
    /// In case if `before` is omitted, returns `count` latest messages.
    func messages(from id: ChatID, for userId: UserID, before: MessageID?, count: Int?) async throws -> [MessageInfo]
    
    /// Creates new message in a chat with `id` (if user with `userId` is not blocked).
    func postMessage(to id: ChatID, with info: PostMessageRequest, by userId: UserID) async throws -> MessageInfo
    
    /// Edits message with `id` in a chat (if user with `userId` is not blocked).
    func updateMessage(_ id: MessageID, with update: UpdateMessageRequest, by userId: UserID) async throws -> MessageInfo
    
    /// Deletes contents of a message with`id`.
    func deleteMessage(_ id: MessageID, by userId: UserID) async throws -> MessageInfo
    
    /// Marks message with`id` as seen by the user with `userId`.
    func readMessage(_ id: MessageID, by userId: UserID) async throws
    
    /// Adds chat's profile picture (not to confuse with user's profile picture in personal chat).
    func addChatImage(_ chatId: ChatID, with info: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo
    
    /// Removes chat's picture with `resourceId`.
    func deleteChatImage(_ resourceId: ResourceID, by userId: UserID) async throws
    
    /// Gets the list of all users blocked in this chat.
    func blockedUsersInChat(_ id: ChatID, with userId: UserID) async throws -> [UserInfo]
    
    /// Broadcasts chat notifications from `userId` to all chat participants.
    /// Use it to inform chat users about typing and other auxiliary events that should not be saved into database.
    func notifyChat(_ chatId: ChatID, with info: ChatNotificationRequest, from userId: UserID) async throws
}

actor ChatService: ChatServiceProtocol {

    private let core: CoreService
    let repo: ChatsRepository
    var currentUser: User?
    
    init(core: CoreService, repo: ChatsRepository) {
        self.core = core
        self.repo = repo
    }
    
    func with(_ currentUser: User?) -> ChatService {
        self.currentUser = currentUser
        return self
    }
    
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatInfo] {
        try await repo.all(with: userId, fullInfo: fullInfo).map {
            ChatInfo(from: $0, fullInfo: fullInfo)
        }
    }
    
    func chat(_ id: ChatID, with userId: UserID) async throws -> ChatInfo {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
            throw ServiceError(.notFound)
        }
        return ChatInfo(from: relation, fullInfo: true)
    }
    
    func createChat(with info: CreateChatRequest, by ownerId: UserID) async throws -> ChatInfo {
        var participants = info.participants.unique()
        guard participants.count > 0 else {
            throw ServiceError(.badRequest, reason: "New chat should contain at least one participant.")
        }
        
        participants = (participants + [ownerId]).unique()
        let participantsKey = Set(participants).participantsKey()
        let isPersonal = info.isPersonal ?? (participants.count == 2)
        
        if isPersonal && participants.count > 2 {
            throw ServiceError(.badRequest, reason: "Personal chats can contain at most two participants.")
        }
        
        var chat = try await repo.find(participantsKey: participantsKey, for: ownerId, isPersonal: isPersonal)
        
        if chat == nil {
            chat = Chat(title: info.title, ownerId: ownerId, isPersonal: isPersonal)
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
    
    func updateChat(_ id: ChatID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
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
        try await core.notificator.notify(chat: chat, in: repo, about: .chatUpdate, from: relation.user, with: info.jsonObject())
        return info
    }
    
    func updateChatSettings(_ id: ChatID, with update: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
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
    
    func addUsers(to id: ChatID, users: [UserID], by userId: UserID) async throws -> ChatInfo {
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
        try await core.notificator.notify(chat: chat, in: repo, about: .addedUsers, from: relation.user, with: info.jsonObject())
        return info
    }
    
    func removeUsers(_ users: [UserID], from id: ChatID, by userId: UserID) async throws -> ChatInfo {
        guard users.count > 0 else {
            throw ServiceError(.badRequest, reason: "No users to remove found.")
        }
        let relations = try await repo.findRelations(of: id, isUserBlocked: false)
        guard let relation = relations.ofUser(userId) else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        if chat.isPersonal {
            throw ServiceError(.badRequest, reason: "You can't alter users in a personal chat.")
        }
        let usersToNotRemove = relations.filter { $0.isChatBlocked }.map { $0.user.id! }
        let usersToRemove = Array(Set(users).subtracting(Set(usersToNotRemove)))
        let usersCache = chat.users
        let usersBefore = chat.users.map { $0.id! }
        try await repo.removeUsers(usersToRemove, from: chat)
        let usersAfter = chat.users.map { $0.id! }
        let removedUsersSet = Set(usersBefore).subtracting(Set(usersAfter))
        let removedUsers = usersCache.filter { removedUsersSet.contains($0.id!) }.map { $0.info() }
        let info = ChatInfo(from: relation, addedUsers: nil, removedUsers: removedUsers)
        try await core.notificator.notify(chat: chat, in: repo, about: .removedUsers, from: relation.user, with: info.jsonObject())
        return info
    }
    
    func deleteChat(_ id: ChatID, by userId: UserID) async throws {
        let relations = try await repo.findRelations(of: id, isUserBlocked: nil)
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
        
        try chat.setLatestMessage(nil)
        try await repo.deleteMessages(from: chat, withMedia: true)
        
        var itemsToSave: [any RepositoryItem] = [chat]
        for relation in relations {
            if !relation.isChatBlocked { // should be visible locally for unblocking
                relation.isRemovedOnDevice = true
                itemsToSave.append(relation)
            }
        }
        try await core.saveAll(itemsToSave)
        try await core.notificator.notify(chat: chat, in: repo, about: .chatDeleted, from: sourceRelation.user, with: nil)
    }
    
    private func setUser(_ targetId: UserID, in chatId: ChatID, blocked: Bool, by userId: UserID) async throws {
        let relations = try await repo.findRelations(of: chatId, isUserBlocked: nil)
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
    
    func blockUser(_ targetId: UserID, in chatId: ChatID, by userId: UserID) async throws {
        try await setUser(targetId, in: chatId, blocked: true, by: userId)
    }
    
    func unblockUser(_ targetId: UserID, in chatId: ChatID, by userId: UserID) async throws {
        try await setUser(targetId, in: chatId, blocked: false, by: userId)
    }
    
    func blockChat(_ id: ChatID, by userId: UserID) async throws {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        relation.isChatBlocked = true
        try await repo.saveRelation(relation)
    }
    
    func unblockChat(_ id: ChatID, by userId: UserID) async throws {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        relation.isChatBlocked = false
        try await repo.saveRelation(relation)
    }
    
    func blockedUsersInChat(_ id: ChatID, with userId: UserID) async throws -> [UserInfo] {
        guard let relation = try await repo.findRelation(of: id, userId: userId), !relation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        let relations = try await repo.findRelations(of: id, isUserBlocked: true)
        return relations.map { $0.user.info() }
    }
    
    func exitChat(_ id: ChatID, by userId: UserID) async throws {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        guard !relation.chat.isPersonal else {
            throw ServiceError(.badRequest)
        }
        try await repo.deleteRelation(relation)
    }
    
    func clearChat(_ id: ChatID, by userId: UserID) async throws {
        guard let relation = try await repo.findRelation(of: id, userId: userId) else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        guard chat.isPersonal || chat.owner.id == userId else {
            throw ServiceError(.forbidden, reason: "You can't clear this chat.")
        }
        try await repo.deleteMessages(from: chat, withMedia: false)
        try await core.notificator.notify(chat: chat, in: repo, about: .chatCleared, from: relation.user, with: nil)
    }
    
    func messages(from id: ChatID, for userId: UserID, before: MessageID?, count: Int?) async throws -> [MessageInfo] {
        guard let relation = try await repo.findRelation(of: id, userId: userId), !relation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        let messages = try await repo.messages(from: id, before: before, count: count ?? 50)
        return messages.map { $0.info() }
    }
    
    func postMessage(to chatId: ChatID, with info: PostMessageRequest, by userId: UserID) async throws -> MessageInfo {
        if info.isEmpty {
            throw ServiceError(.badRequest, reason: "Message is empty.")
        }
        let relations = try await repo.findRelations(of: chatId, isUserBlocked: false)
        guard relations.count > 0 else {
            throw ServiceError(.notFound)
        }
        guard let authorRelation = relations.ofUser(userId) else {
            throw ServiceError(.forbidden, reason: "You can't post into this chat.")
        }
        
        let chat = authorRelation.chat
        let recipientsRelations = relations.otherThen(userId)
        let otherUserRelation = chat.isPersonal ? recipientsRelations.first : nil
        
        if chat.isPersonal {
            guard recipientsRelations.count <= 1 else { // 0 for personal notes
                throw ServiceError(.internalServerError, reason: "Personal chat should have only one recipient.")
            }
            if let isChatBlocked = otherUserRelation?.isChatBlocked, isChatBlocked {
                throw ServiceError(.forbidden, reason: "This chat was blocked.")
            }
        }
        
        guard let localId = info.localId, localId.count >= UUID().uuidString.count else { // localId should be "UserID+UUID"
            throw ServiceError(.badRequest, reason: "Malformed message data.")
        }
        
        if let attachments = info.attachments {
            for attachment in attachments {
                guard attachment.fileSize > 0 && !attachment.fileType.isEmpty else {
                    throw ServiceError(.badRequest, reason: "Malformed message data.")
                }
            }
        }
        
        if let text = info.text {
            guard text.count > 0 && text.count <= 2048 else {
                throw ServiceError(.badRequest, reason: "Message text should be between 1 and 2048 characters long.")
            }
        }
        
        // Validate replyTo if provided
        if let replyToId = info.replyTo {
            // Check if the replied-to message exists and belongs to the same chat
            guard let repliedMessage = try await repo.findMessage(id: replyToId) else {
                throw ServiceError(.badRequest, reason: "Replied message not found.")
            }
            guard repliedMessage.$chat.id == chatId else {
                throw ServiceError(.badRequest, reason: "Replied message does not belong to this chat.")
            }
        }
        
        let message = Message(localId: localId,
                              authorId: userId,
                              chatId: chatId,
                              text: info.text,
                              isVisible: info.isVisible ?? true)
        
        if let replyToId = info.replyTo {
            message.$replyTo.id = replyToId
        }
        
        try await repo.saveMessage(message)
        
        try chat.setLatestMessage(message)
        
        var attachmentsToSave: [any RepositoryItem] = []
        
        if let attachments = info.attachments {
            for attachment in attachments {
                let resource = MediaResource(id: attachment.id,
                                             attachmentOf: message.id!,
                                             fileType: attachment.fileType,
                                             fileSize: attachment.fileSize,
                                             previewWidth: attachment.previewWidth ?? 300,
                                             previewHeight: attachment.previewHeight ?? 200)
                attachmentsToSave.append(resource)
            }
        }
        
        var itemsToSave: [any RepositoryItem] = [chat]
        
        if authorRelation.isArchived || authorRelation.isRemovedOnDevice {
            authorRelation.isArchived = false
            authorRelation.isRemovedOnDevice = false
            itemsToSave.append(authorRelation)
        }
        
        if let otherUserRelation {
            if otherUserRelation.isRemovedOnDevice {
                otherUserRelation.isRemovedOnDevice = false
                itemsToSave.append(otherUserRelation)
            }
        }
        
        try await core.saveAll(itemsToSave + attachmentsToSave)
        
        if !attachmentsToSave.isEmpty {
            try await repo.loadAttachments(for: message)
        }
        
        let info = message.info()
        try await core.notificator.notify(chat: chat, via: .all, in: repo, about: .message, from: authorRelation.user, with: info.jsonObject())
        return info
    }
    
    func updateMessage(_ id: MessageID, with update: UpdateMessageRequest, by userId: UserID) async throws -> MessageInfo {
        guard let message = try await repo.findMessage(id: id), message.author.id == userId else {
            throw ServiceError(.forbidden)
        }
        guard let authorRelation = message.chat.relations.ofUser(userId), !authorRelation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        guard message.deletedAt == nil else {
            throw ServiceError(.badRequest, reason: "You can't edit deleted message.")
        }
        
        var shouldSave = false
        var shouldReload = false
        if let text = update.text {
            message.text = text
            message.editedAt = Date()
            shouldSave = true
        }
        if let isVisible = update.isVisible, !message.isVisible {
            message.isVisible = isVisible
            shouldSave = true
        }
        
        // Handle attachments
        var itemsToSave: [any RepositoryItem] = []
        
        if let attachments = update.attachments {
            // Load current attachments
            try await repo.loadAttachments(for: message)
            let currentAttachmentIds = Set(message.attachments.compactMap { $0.id })
            let newAttachmentIds = Set(attachments.compactMap { $0.id })
            
            // Find attachments to remove (in current but not in new)
            let attachmentsToRemove = currentAttachmentIds.subtracting(newAttachmentIds)
            
            // Find attachments to add (in new but not in current)
            let attachmentsToAdd = newAttachmentIds.subtracting(currentAttachmentIds)
            
            // Remove attachments by setting attachment_of to nil
            for attachmentId in attachmentsToRemove {
                if let attachment = message.attachments.first(where: { $0.id == attachmentId }) {
                    attachment.$attachmentOf.id = nil
                    itemsToSave.append(attachment)
                    shouldReload = true
                }
            }
            
            // Create new attachments with data from UpdateMessageRequest
            for attachmentId in attachmentsToAdd {
                if let attachmentInfo = attachments.first(where: { $0.id == attachmentId }) {
                    let resource = MediaResource(id: attachmentId,
                                                 attachmentOf: message.id!,
                                                 fileType: attachmentInfo.fileType,
                                                 fileSize: attachmentInfo.fileSize,
                                                 previewWidth: attachmentInfo.previewWidth ?? 300,
                                                 previewHeight: attachmentInfo.previewHeight ?? 200)
                    itemsToSave.append(resource)
                    shouldReload = true
                }
            }
        }
        
        if shouldSave {
            itemsToSave.append(message)
        }
        
        if !itemsToSave.isEmpty {
            try await core.saveAll(itemsToSave)
        }
        
        if shouldReload || update.fileExists ?? false || update.previewExists ?? false {
            try await repo.loadAttachments(for: message)
        }
        
        let info = message.info()
        try await core.notificator.notify(chat: message.chat, in: repo, about: .messageUpdate, from: authorRelation.user, with: info.jsonObject())
        return info
    }
    
    func deleteMessage(_ id: MessageID, by userId: UserID) async throws -> MessageInfo {
        guard let message = try await repo.findMessage(id: id) else {
            throw ServiceError(.notFound)
        }
        message.text = ""
        message.editedAt = Date()
        message.deletedAt = Date()
        message.$replyTo.id = nil
        
        var itemsToSave = [message as any RepositoryItem]
        
        // Load attachments if not already loaded
        if message.$attachments.value == nil {
            try await repo.loadAttachments(for: message)
        }
        
        // Set attachment_of to null and delete files
        message.attachments.forEach { res in
            try? core.removeFiles(for: res)
            res.$attachmentOf.id = nil
            res.fileSize = 0
            itemsToSave.append(res)
        }
        
        try await core.saveAll(itemsToSave)
        
        let info = message.info()
        try await core.notificator.notify(chat: message.chat, in: repo, about: .messageUpdate, from: message.author, with: info.jsonObject())
        return info
    }
    
    func readMessage(_ id: MessageID, by userId: UserID) async throws {
        guard let message = try await repo.findMessage(id: id) else {
            throw ServiceError(.notFound)
        }
        guard let readerRelation = message.chat.relations.ofUser(userId) else {
            throw ServiceError(.forbidden)
        }
        if message.readMarks.first(where: { $0.user.id == userId }) == nil {
            let readMark = ReadMark(messageId: id, userId: userId)
            try await core.saveItem(readMark)
            let info = message.info()
            try await core.notificator.notify(chat: message.chat, in: repo, about: .messageUpdate, from: readerRelation.user, with: info.jsonObject())
        }
    }
    
    func addChatImage(_ chatId: ChatID, with info: UpdateChatRequest, by userId: UserID) async throws -> ChatInfo {
        guard let relation = try await repo.findRelation(of: chatId, userId: userId), !relation.isUserBlocked else {
            throw ServiceError(.forbidden)
        }
        let chat = relation.chat
        guard chat.owner.id == userId else {
            throw ServiceError(.forbidden)
        }
        if relation.chat.isPersonal {
            throw ServiceError(.badRequest, reason: "You can't update personal chat.")
        }
        guard let resource = info.image, let resourceId = resource.id else {
            throw ServiceError(.badRequest, reason: "Media resource id is missing.")
        }
        guard resource.fileType != "", resource.fileSize > 0 else {
            throw ServiceError(.badRequest, reason: "Media fileType or fileSize are missing.")
        }
        let image = MediaResource(id: resourceId,
                                  imageOf: chat.id!,
                                  fileType: resource.fileType,
                                  fileSize: resource.fileSize,
                                  previewWidth: resource.previewWidth ?? 100,
                                  previewHeight: resource.previewHeight ?? 100)
        try await repo.saveChatImage(image)
        try await repo.reloadChatImages(for: chat)
        return ChatInfo(from: relation, fullInfo: false)
    }
    
    func deleteChatImage(_ resourceId: ResourceID, by userId: UserID) async throws {
        guard let resource = try await repo.findChatImage(resourceId) else {
            throw ServiceError(.notFound, reason: "Media resource is missing.")
        }
        guard resource.imageOf?.owner.id == userId else {
            throw ServiceError(.forbidden)
        }
        try core.removeFiles(for: resource)
        try await repo.deleteChatImage(resource)
    }
    
    func notifyChat(_ chatId: ChatID, with info: ChatNotificationRequest, from userId: UserID) async throws {
        let relations = try await repo.findRelations(of: chatId, isUserBlocked: false)
        guard relations.count > 0 else {
            throw ServiceError(.notFound)
        }
        guard let authorRelation = relations.ofUser(userId) else {
            throw ServiceError(.forbidden, reason: "You can't post into this chat.")
        }
        
        let chat = authorRelation.chat
        let recipientsRelations = relations.otherThen(userId)
        
        if chat.isPersonal {
            guard recipientsRelations.count == 1 else {
                throw ServiceError(.internalServerError, reason: "Personal chat should have only one recipient.")
            }
            guard !recipientsRelations[0].isChatBlocked else {
                throw ServiceError(.forbidden, reason: "This chat was blocked.")
            }
        }
        
        // TODO: improve this together with JSON type
        // Converting REST payload to WebSocket one:
        let payload: JSON = [
            "name": info.name,
            "text": info.text,
            "data": try info.data?.jsonObject()
        ]
        try await core.notificator.notify(chat: chat, via: info.realm, in: repo, about: .auxiliary, from: authorRelation.user, with: payload)
    }
}

extension PostMessageRequest {
    var isEmpty: Bool {
        (attachments == nil || attachments!.isEmpty) && text == nil
    }
}
