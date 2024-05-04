import Fluent

final class Chat: RepositoryItem {
    static let schema = "chats"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "title")
    var title: String?
    
    @Field(key: "is_personal")
    var isPersonal: Bool
    
    @Field(key: "participants_key")
    var participantsKey: String
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?
    
    @Parent(key: "owner_id")
    var owner: User
    
    @OptionalParent(key: "last_message_id")
    var lastMessage: Message?
    
    @Siblings(
        through: ChatToUser.self,
        from: \.$chat,
        to: \.$user)
    var users: [User]
    
    init() {}
    
    init(id: UUID? = nil,
         title: String? = nil,
         ownerId: UserID,
         isPersonal: Bool
    ) {
        self.id = id
        self.title = title
        self.$owner.id = ownerId
        self.isPersonal = isPersonal
    }
}

extension Chat {
    
    struct Info: Serializable {
        var id: UUID?
        var title: String?
        var isPersonal: Bool?
        var owner: UserInfo?
        var users: [UserInfo]?
        var lastMessage: MessageInfo?
        
        var isMuted: Bool?
        var isArchived: Bool?
        var isBlocked: Bool?
        
        init(from relation: ChatRelation, fullInfo: Bool = false) {
            let chat = relation.chat
            self.id = chat.id
            self.title = chat.title
            self.isPersonal = chat.isPersonal
            self.owner = chat.owner.info()
            if let lastMessage = chat.lastMessage {
                self.lastMessage = lastMessage.info()
            }
            self.isMuted = relation.isMuted
            self.isArchived = relation.isArchived
            self.isBlocked = relation.isBlocked
            if fullInfo {
                self.users = chat.users.map { $0.info() }
            }
        }
    }
}

typealias ChatInfo = Chat.Info

extension Set where Element == UserID {
    
    func participantsKey() -> String {
        sorted().map { "\($0)" }.joined(separator: "+")
    }
}

extension Array where Element == UserID {
    
    func participantsKey() -> String {
        Set(self).participantsKey()
    }
}
