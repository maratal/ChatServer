import Fluent
import Foundation

final class Message: RepositoryItem, @unchecked Sendable /* https://blog.vapor.codes/posts/fluent-models-and-sendable */ {
    static let schema = "messages"
    
    @ID(key: .id)
    var id: MessageID?
    
    @Field(key: "local_id")
    var localId: UUID
    
    @Field(key: "text")
    var text: String?
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?
    
    @Field(key: "edited_at")
    var editedAt: Date?
    
    @Field(key: "deleted_at")
    var deletedAt: Date?
    
    @Field(key: "is_visible")
    var isVisible: Bool
    
    @Parent(key: "author_id")
    var author: User
    
    @Parent(key: "chat_id")
    var chat: Chat
    
    @Children(for: \.$message)
    var readMarks: [ReadMark]
    
    @Children(for: \.$attachmentOf)
    var attachments: [MediaResource]
    
    required init() {}
    
    init(
        id: MessageID? = nil,
        localId: UUID,
        authorId: UserID,
        chatId: ChatID,
        text: String?,
        isVisible: Bool = true
    ) {
        self.id = id
        self.localId = localId
        self.$author.id = authorId
        self.$chat.id = chatId
        self.text = text
        self.editedAt = nil
        self.deletedAt = nil
        self.isVisible = isVisible
    }
}

extension Message {
    
    struct Info: Serializable {
        var id: MessageID?
        var localId: UUID?
        var chatId: ChatID?
        var authorId: UserID?
        var text: String?
        var createdAt: Date?
        var updatedAt: Date?
        var editedAt: Date?
        var deletedAt: Date?
        var isVisible: Bool?
        var readMarks: [ReadMark.Info]?
        var attachments: [MediaInfo]?
        
        init(from message: Message) {
            self.id = message.id
            self.localId = message.localId
            self.chatId = message.$chat.id
            self.authorId = message.$author.id
            self.text = message.text
            self.createdAt = message.createdAt
            self.updatedAt = message.updatedAt
            self.editedAt = message.editedAt
            self.deletedAt = message.deletedAt
            self.isVisible = message.isVisible
            if message.$readMarks.value != nil {
                self.readMarks = message.readMarks.map { $0.info() }
            }
            if message.$attachments.value != nil {
                self.attachments = message.attachments.map { $0.info() }
            }
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}

typealias MessageInfo = Message.Info

extension MessageInfo: JSONSerializable {
    
    var readAt: Date? {
        readMarks?.first(where: { $0.user?.id != authorId })?.createdAt
    }
    
    func jsonObject() throws -> JSON {
        var dict = try json() as! JSON
//        if let createdAt {
//            dict["createdAt"] = Service.dateFormatter.string(from: createdAt)
//        }
//        if let updatedAt {
//            dict["updatedAt"] = Service.dateFormatter.string(from: updatedAt)
//        }
//        if let readAt {
//            dict["readAt"] = Service.dateFormatter.string(from: readAt)
//        }
        return dict
    }
}
