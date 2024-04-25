import Fluent

final class Chat: Model {
    static let schema = "chats"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "title")
    var title: String?
    
    @Field(key: "is_personal")
    var isPersonal: Bool
    
    @Field(key: "participants_key")
    var participantsKey: String
    
    @Field(key: "created_at")
    var createdAt: Date?
    
    @Field(key: "updated_at")
    var updatedAt: Date?
    
    @Parent(key: "owner_id")
    var owner: User
    
    @OptionalParent(key: "last_message_id")
    var lastMessage: Message?
    
    @Children(for: \.$chat)
    var users: [ChatToUser]
    
    @Children(for: \.$chat)
    var messages: [Message]
    
    init() {}
    
    init(id: UUID? = nil,
         title: String? = nil,
         ownerId: UserID,
         isPersonal: Bool,
         participantsKey: String
    ) {
        self.id = id
        self.title = title
        self.$owner.id = ownerId
        self.isPersonal = isPersonal
        self.participantsKey = participantsKey
    }
}

extension Chat {
    
    var participants: [User] {
        users.map { $0.user }
    }
    
    struct Info: Serializable {
        var id: UUID?
        var title: String?
        var isPersonal: Bool?
        var owner: UserInfo?
        var participants: [UserInfo]?
        var lastMessage: MessageInfo?
        
        var isMuted: Bool?
        var isArchived: Bool?
        var isBlocked: Bool?
        
        init(from relation: ChatRelation) {
            self.id = relation.chat.id
            self.title = relation.chat.title
            self.isPersonal = relation.chat.isPersonal
            self.owner = relation.chat.owner.info()
            self.participants = relation.chat.participants.map { $0.info() }
            if let lastMessage = relation.chat.lastMessage {
                self.lastMessage = lastMessage.info()
            }
            self.isMuted = relation.isMuted
            self.isArchived = relation.isArchived
            self.isBlocked = relation.isBlocked
        }
    }
}

typealias ChatInfo = Chat.Info
