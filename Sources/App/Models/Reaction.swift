import Fluent

final class Reaction: RepositoryItem {
    static let schema = "reactions"
    
    @ID(key: .id)
    var id: UUID?
    
    @Parent(key: "message_id")
    var message: Message
    
    @Parent(key: "user_id")
    var user: User
    
    @Field(key: "badge")
    var badge: String?
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    init() {}
    
    init(id: UUID? = nil, messageId: UUID, userId: UserID, badge: Reactions) {
        self.id = id
        self.$message.id = messageId
        self.$user.id = userId
        self.badge = badge.rawValue
    }
}

extension Reaction {
    
    struct Info: Serializable {
        var id: UUID?
        var user: UserInfo?
        var badge: String?
        var createdAt: Date?
        
        init(from source: Reaction) {
            self.id = source.id
            self.user = source.user.info()
            self.badge = source.badge
            self.createdAt = source.createdAt
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}

enum Reactions: String {
    case seen
    case like = "👍"
    case loveit = "❤️"
    case boo = "👎"
    case ffs = "🤌"
    case wtf = "⁉️"
    case bananas = "🍌🍌🍌"
}
