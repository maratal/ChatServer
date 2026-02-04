import Fluent
import Foundation

final class Chat: RepositoryItem, @unchecked Sendable /* https://blog.vapor.codes/posts/fluent-models-and-sendable */ {
    static let schema = "chats"
    
    @ID(key: .id)
    var id: ChatID?
    
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
    
    @Children(for: \.$chat)
    var relations: [ChatRelation]
    
    @Children(for: \.$imageOf)
    var images: [MediaResource]
    
    init() {}
    
    init(id: ChatID? = nil,
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
    
    func setLatestMessage(_ message: Message?) throws {
        self.$lastMessage.id = try message?.requireID()
    }
    
    struct Info: Serializable {
        var id: ChatID?
        var title: String?
        var isPersonal: Bool?
        var owner: UserInfo?
        var allUsers: [UserInfo]?
        var addedUsers: [UserInfo]?
        var removedUsers: [UserInfo]?
        var lastMessage: MessageInfo?
        var images: [MediaInfo]?
        var updatedAt: Date
        var createdAt: Date
        
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
            if chat.$images.value != nil {
                self.images = chat.images.map { $0.info() }
            }
            self.updatedAt = chat.updatedAt ?? Date()
            self.createdAt = chat.createdAt ?? Date()
            self.isMuted = relation.isMuted
            self.isArchived = relation.isArchived
            self.isBlocked = relation.isChatBlocked
            if fullInfo {
                self.allUsers = chat.users.map { $0.fullInfo() }
            }
        }
        
        init(from relation: ChatRelation, addedUsers: [UserInfo]?, removedUsers: [UserInfo]?) {
            let chat = relation.chat
            self.id = chat.id
            self.title = chat.title
            self.isPersonal = chat.isPersonal
            self.owner = chat.owner.info()
            if let lastMessage = chat.lastMessage {
                self.lastMessage = lastMessage.info()
            }
            if chat.$images.value != nil {
                self.images = chat.images.map { $0.info() }
            }
            self.updatedAt = chat.updatedAt ?? Date()
            self.createdAt = chat.createdAt ?? Date()
            self.isMuted = relation.isMuted
            self.isArchived = relation.isArchived
            self.isBlocked = relation.isChatBlocked
            self.addedUsers = addedUsers
            self.removedUsers = removedUsers
        }
        
        init(from chat: Chat) {
            self.id = chat.id
            self.title = chat.title
            self.isPersonal = chat.isPersonal
            self.owner = chat.owner.info()
            if let lastMessage = chat.lastMessage {
                self.lastMessage = lastMessage.info()
            }
            if chat.$images.value != nil {
                self.images = chat.images.map { $0.info() }
            }
            self.updatedAt = chat.updatedAt ?? Date()
            self.createdAt = chat.createdAt ?? Date()
        }
    }
}

typealias ChatInfo = Chat.Info

extension ChatInfo: JSONSerializable {
    
    func jsonObject() throws -> JSON {
        try json() as! JSON
    }
}

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
