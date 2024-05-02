import FluentKit

protocol Users {
    func fetch(id: Int) async throws -> User
    func find(id: Int) async throws -> User?
    func save(_ user: User) async throws
    func delete(_ user: User) async throws
    func search(_ s: String) async throws -> [User]
    
    func findContact(_ id: UUID) async throws -> Contact?
    func findContact(userId: UserID, ownerId: UserID) async throws -> Contact?
    func contacts(of user: User) async throws -> [Contact]
    func saveContact(_ contact: Contact) async throws
    func deleteContact(_ contact: Contact) async throws
    
    func findChat(participantsKey: String, for userId: UserID, isPersonal: Bool) async throws -> Chat?
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatRelation]
    func saveChat(_ chat: Chat, with users: [UserID]?) async throws
    
    func findChatRelation(_ id: UUID, for userId: UserID) async throws -> ChatRelation?
    func saveChatRelation(_ relation: ChatRelation) async throws
}

struct UsersDatabaseRepository: Users, DatabaseRepository {
    var database: Database

    func fetch(id: UserID) async throws -> User {
        try await User.find(id, on: database).get()!
    }
    
    func find(id: UserID) async throws -> User? {
        try await User.find(id, on: database).get()
    }
    
    func save(_ user: User) async throws {
        try await user.save(on: database)
    }
    
    func delete(_ user: User) async throws {
        try await user.delete(on: database)
    }
    
    func search(_ s: String) async throws -> [User] {
        try await User.query(on: database).group(.or) { query in
            query.filter(\.$name ~~ s)
            query.filter(\.$username ~~ s)
        }.range(..<100).all()
    }
    
    func findContact(_ id: UUID) async throws -> Contact? {
        try await Contact.find(id, on: database)
    }
    
    func findContact(userId: UserID, ownerId: UserID) async throws -> Contact? {
        try await Contact.query(on: database).group(.and) { query in
            query.filter(\.$user.$id == userId)
            query.filter(\.$owner.$id == ownerId)
        }.first()
    }
    
    func contacts(of user: User) async throws -> [Contact] {
        try await Contact.query(on: database)
            .with(\.$user)
            .filter(\.$owner.$id == user.requireID())
            .all()
    }
    
    func saveContact(_ contact: Contact) async throws {
        try await contact.save(on: database)
    }
    
    func deleteContact(_ contact: Contact) async throws {
        try await contact.delete(on: database)
    }
    
    func findChatRelation(_ chatId: UUID, for userId: UserID) async throws -> ChatRelation? {
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
    
    func findChat(participantsKey: String, for userId: UserID, isPersonal: Bool) async throws -> Chat? {
        try await Chat.query(on: database)
            .filter(\.$participantsKey == participantsKey)
            .filter(\.$isPersonal == isPersonal)
            .with(\.$owner)
            .with(\.$users)
            .first()
    }
    
    func chats(with userId: UserID, fullInfo: Bool) async throws -> [ChatRelation] {
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
    
    func saveChat(_ chat: Chat, with users: [UserID]? = nil) async throws {
        if let users, !users.isEmpty {
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
                try await withThrowingTaskGroup(of: Void.self) { group in
                    for userId in newUsers {
                        group.addTask {
                            let relation = try ChatRelation(chatId: chat.requireID(), userId: userId)
                            try await relation.save(on: database)
                        }
                    }
                    try await group.waitForAll()
                }
                _ = try await chat.$users.get(reload: true, on: database)
            }
        } else {
            try await chat.save(on: database)
        }
    }
    
    func saveChatRelation(_ relation: ChatRelation) async throws {
        try await relation.save(on: database)
    }
}
