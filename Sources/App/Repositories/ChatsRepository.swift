import FluentKit
import Foundation

protocol ChatsRepository: Sendable {
    func fetch(id: ChatID) async throws -> Chat
    func find(participantsKey: String, for userId: UserID, isPersonal: Bool) async throws -> Chat?
    func findRelations(of chatId: ChatID, isUserBlocked: Bool?) async throws -> [ChatRelation]
    func findRelation(of chatId: ChatID, userId: UserID) async throws -> ChatRelation?
    func all(with userId: UserID, fullInfo: Bool) async throws -> [ChatRelation]
    
    func save(_ chat: Chat) async throws
    func save(_ chat: Chat, with users: [UserID]) async throws
    func delete(_ chat: Chat) async throws
    func removeUsers(_ users: [UserID], from chat: Chat) async throws
    func saveRelation(_ relation: ChatRelation) async throws
    func deleteRelation(_ relation: ChatRelation) async throws

    func findMessage(id: MessageID) async throws -> Message?
    func messages(from chatId: ChatID, before: Date?, count: Int) async throws -> [Message]
    func saveMessage(_ message: Message) async throws
    func loadAttachments(for message: Message) async throws
    func deleteMessages(from chat: Chat) async throws
    
    func findReadMarks(for messageId: MessageID) async throws -> [ReadMark]
    
    func findChatImage(_ id: ResourceID) async throws -> MediaResource?
    func saveChatImage(_ image: MediaResource) async throws
    func deleteChatImage(_ image: MediaResource) async throws
    func reloadChatImages(for chat: Chat) async throws
}

actor ChatsDatabaseRepository: DatabaseRepository, ChatsRepository {

    private let core: CoreService
    let database: any Database
    
    init(core: CoreService) {
        self.core = core
        self.database = core.database
    }
    
    func fetch(id: ChatID) async throws -> Chat {
        try await Chat.find(id, on: database)!
    }
    
    func findRelations(of chatId: ChatID, isUserBlocked: Bool? = nil) async throws -> [ChatRelation] {
        var query = ChatRelation.query(on: database).filter(\.$chat.$id == chatId)
        if let isUserBlocked = isUserBlocked {
            query = query.filter(\.$isUserBlocked == isUserBlocked)
        }
        return try await query
            .with(\.$user) { user in
                user.with(\.$deviceSessions)
            }
            .with(\.$chat) { chat in
                chat.with(\.$owner)
                chat.with(\.$lastMessage)
                chat.with(\.$users) // TODO: optimise
            }
            .all()
    }
    
    func findRelation(of chatId: ChatID, userId: UserID) async throws -> ChatRelation? {
        try await ChatRelation.query(on: database)
            .filter(\.$chat.$id == chatId)
            .filter(\.$user.$id == userId)
            .with(\.$user) { user in
                user.with(\.$deviceSessions)
            }
            .with(\.$chat) { chat in
                chat.with(\.$owner)
                chat.with(\.$lastMessage)
                chat.with(\.$users) { user in
                    user.with(\.$photos)
                }
                chat.with(\.$images)
            }
            .first()
    }
    
    func find(participantsKey: String, for userId: UserID, isPersonal: Bool) async throws -> Chat? {
        try await Chat.query(on: database)
            .filter(\.$participantsKey == participantsKey)
            .filter(\.$isPersonal == isPersonal)
            .with(\.$owner)
            .with(\.$users)
            .first()
    }
    
    func all(with userId: UserID, fullInfo: Bool) async throws -> [ChatRelation] {
        try await ChatRelation.query(on: database)
            .filter(\.$user.$id == userId)
            .filter(\.$isRemovedOnDevice == false)
            .with(\.$chat) { chat in
                chat.with(\.$owner)
                chat.with(\.$lastMessage)
                chat.with(\.$images)
                if (fullInfo) {
                    chat.with(\.$users)
                }
            }
            .all()
    }
    
    func save(_ chat: Chat) async throws {
        try await chat.save(on: database)
    }
    
    func save(_ chat: Chat, with users: [UserID]) async throws {
        guard users.count > 0 else {
            return try await save(chat)
        }
        if chat.isPersonal && users.count > 1 {
            throw ServiceError(.unprocessableEntity, reason: "Personal chat can only contain two users.")
        }
        var allUsers = Set<UserID>()
        var newUsers = Set<UserID>()
        if chat.id == nil {
            allUsers = Set([chat.$owner.id] + users)
            newUsers = allUsers
        } else {
            allUsers = Set(users + chat.users.compactMap { $0.id })
            newUsers = Set(users)
        }
        if newUsers.count > 0 {
            chat.participantsKey = allUsers.participantsKey()
            try await chat.save(on: database)
            try await core.saveAll(
                newUsers.map { ChatRelation(chatId: try chat.requireID(), userId: $0) }
            )
            _ = try await chat.$users.get(reload: true, on: database)
        }
    }
    
    func saveRelation(_ relation: ChatRelation) async throws {
        try await relation.save(on: database)
    }
    
    func removeUsers(_ users: [UserID], from chat: Chat) async throws {
        guard let chatId = chat.id else {
            throw ServiceError(.unprocessableEntity, reason: "Chat wasn't saved yet.")
        }
        guard users.count > 0 else {
            throw ServiceError(.unprocessableEntity, reason: "No users provided.")
        }
        try await ChatRelation.query(on: database)
            .filter(\.$chat.$id == chatId)
            .filter(\.$user.$id ~~ users)
            .delete()
        
        _ = try await chat.$users.get(reload: true, on: database)
        
        let participantsKey = Set(chat.users.compactMap { $0.id }).participantsKey()
        guard participantsKey != chat.participantsKey else {
            throw ServiceError(.unprocessableEntity, reason: "Users provided are not participants of this chat.")
        }
        chat.participantsKey = participantsKey
        try await chat.save(on: database)
    }
    
    func findMessage(id: MessageID) async throws -> Message? {
        try await Message.query(on: database)
            .filter(\.$id == id)
            .with(\.$author)
            .with(\.$readMarks) { reaction in
                reaction.with(\.$user)
            }
            .with(\.$chat) { chat in
                chat.with(\.$relations) { relation in
                    relation.with(\.$user)
                }
            }
            .with(\.$attachments)
            .first()
    }
    
    func messages(from chatId: ChatID, before: Date?, count: Int) async throws -> [Message] {
        if let date = before {
            return try await Message.query(on: database)
                .filter(\.$chat.$id == chatId)
                .with(\.$attachments)
                .sort(\.$createdAt, .descending)
                .filter(\.$createdAt < date)
                .range(..<count)
                .all()
        } else {
            return try await Message.query(on: database)
                .filter(\.$chat.$id == chatId)
                .with(\.$attachments)
                .sort(\.$createdAt, .descending)
                .range(..<count)
                .all()
        }
    }
    
    func saveMessage(_ message: Message) async throws {
        try await message.save(on: database)
    }
    
    func loadAttachments(for message: Message) async throws {
        _ = try await message.$attachments.get(reload: true, on: database)
    }
    
    func delete(_ chat: Chat) async throws {
        try await chat.delete(on: database)
    }
    
    func deleteRelation(_ relation: ChatRelation) async throws {
        try await relation.delete(on: database)
    }
    
    func deleteMessages(from chat: Chat) async throws {
        try await Message.query(on: database)
            .filter(\.$chat.$id == chat.requireID())
            .delete()
    }
    
    func findReadMarks(for messageId: MessageID) async throws -> [ReadMark] {
        try await ReadMark.query(on: database)
            .filter(\.$message.$id == messageId)
            .all()
    }
    
    func findChatImage(_ id: ResourceID) async throws -> MediaResource? {
        try await MediaResource.query(on: database)
            .filter(\.$id == id)
            .with(\.$imageOf) { chat in
                chat.with(\.$owner)
            }
            .first()
    }
    
    func saveChatImage(_ image: MediaResource) async throws {
        try await image.save(on: database)
    }
    
    func deleteChatImage(_ image: MediaResource) async throws {
        try await image.delete(on: database)
    }
    
    func reloadChatImages(for chat: Chat) async throws {
        _ = try await chat.$images.get(reload: true, on: database)
    }
}
