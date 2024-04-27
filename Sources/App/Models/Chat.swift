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
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
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
                self.participants = chat.participants.map { $0.info() }
            }
        }
    }
}

typealias ChatInfo = Chat.Info

extension Array where Element == UserID {
    
    func participantsKey() -> String {
        sorted().map { "\($0)" }.joined(separator: "-")
    }
}
