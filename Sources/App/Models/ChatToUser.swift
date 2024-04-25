import Fluent

final class ChatToUser: Model {
    static let schema = "chats_to_users"
    
    @ID(key: .id)
    var id: UUID?
    
    @Parent(key: "chat_id")
    var chat: Chat
    
    @Parent(key: "user_id")
    var user: User
    
    @Field(key: "muted")
    var isMuted: Bool?
    
    @Field(key: "archived")
    var isArchived: Bool?
    
    @Field(key: "blocked")
    var isBlocked: Bool?
    
    @Field(key: "removed_on_device")
    var isRemovedOnDevice: Bool
    
    init() {}
    
    init(id: UUID? = nil, chatId: UUID, userId: UserID) {
        self.id = id
        self.$chat.id = chatId
        self.$user.id = userId
    }
}

typealias ChatRelation = ChatToUser
