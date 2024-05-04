import FluentKit

protocol Chats {
    func fetch(id: UUID) async throws -> Chat
    func find(participantsKey: String, for userId: UserID, isPersonal: Bool) async throws -> Chat?
    func findRelations(of chatId: UUID) async throws -> [ChatRelation]
    func findRelation(of chatId: UUID, userId: UserID) async throws -> ChatRelation?
    func all(with userId: UserID, fullInfo: Bool) async throws -> [ChatRelation]
    
    func save(_ chat: Chat) async throws
    func saveRelation(_ relation: ChatRelation) async throws
    func save(_ chat: Chat, with users: [UserID]) async throws
    func deleteUsers(_ users: [UserID], from chat: Chat) async throws
    
    func messages(from chatId: UUID, before: Date?, count: Int) async throws -> [Message]
    func saveMessage(_ message: Message) async throws
}

struct ChatsDatabaseRepository: Chats, DatabaseRepository {
    var database: Database
    
    func fetch(id: UUID) async throws -> Chat {
        try await Chat.find(id, on: database)!
    }
    
    func findRelations(of chatId: UUID) async throws -> [ChatRelation] {
        try await ChatRelation.query(on: database)
            .filter(\.$chat.$id == chatId)
            .with(\.$chat) { chat in
                chat.with(\.$owner)
                chat.with(\.$lastMessage)
                chat.with(\.$users)
            }
            .all()
    }
    
    func findRelation(of chatId: UUID, userId: UserID) async throws -> ChatRelation? {
        try await ChatRelation.query(on: database)
            .filter(\.$chat.$id == chatId)
            .filter(\.$user.$id == userId)
            .with(\.$chat) { chat in
                chat.with(\.$owner)
                chat.with(\.$lastMessage)
                chat.with(\.$users)
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
            throw ServerError(.unprocessableEntity, reason: "Personal chat can only contain two users.")
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
            try await Repositories.saveAll(
                newUsers.map { ChatRelation(chatId: try chat.requireID(), userId: $0) }
            )
            _ = try await chat.$users.get(reload: true, on: database)
        }
    }
    
    func saveRelation(_ relation: ChatRelation) async throws {
        try await relation.save(on: database)
    }
    
    func deleteUsers(_ users: [UserID], from chat: Chat) async throws {
        guard let chatId = chat.id else {
            throw ServerError(.unprocessableEntity, reason: "Chat wasn't saved yet.")
        }
        let relations = try await ChatRelation.query(on: database)
            .filter(\.$chat.$id == chatId)
            .filter(\.$user.$id ~~ users)
            .all()
        guard relations.count > 0 else {
            throw ServerError(.unprocessableEntity, reason: "Users provided are not participants of this chat.")
        }
        try await withThrowingTaskGroup(of: Void.self) { group in
            for relation in relations {
                group.addTask {
                    try await relation.delete(on: database)
                }
            }
            try await group.waitForAll()
        }
        _ = try await chat.$users.get(reload: true, on: database)
        chat.participantsKey = Set(chat.users.compactMap { $0.id }).participantsKey()
        try await chat.save(on: database)
    }
    
    func messages(from chatId: UUID, before: Date?, count: Int) async throws -> [Message] {
        if let date = before {
            return try await Message.query(on: database)
                .filter(\.$chat.$id == chatId)
                .sort(\.$createdAt, .descending)
                .filter(\.$createdAt < date)
                .range(..<count)
                .all()
        } else {
            return try await Message.query(on: database)
                .filter(\.$chat.$id == chatId)
                .sort(\.$createdAt, .descending)
                .range(..<count)
                .all()
        }
    }
    
    func saveMessage(_ message: Message) async throws {
        try await message.save(on: database)
    }
}
