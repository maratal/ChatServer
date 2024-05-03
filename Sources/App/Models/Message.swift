import Fluent

final class Message: Model {
    static let schema = "messages"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "local_id")
    var localId: UUID
    
    @Field(key: "text")
    var text: String?
    
    @Field(key: "file_type")
    var fileType: String?
    
    @Field(key: "file_size")
    var fileSize: Int64?
    
    @Field(key: "preview_width")
    var previewWidth: Int?
    
    @Field(key: "preview_height")
    var previewHeight: Int?
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?
    
    @Field(key: "read_at")
    var readAt: Date?
    
    @Field(key: "is_visible")
    var isVisible: Bool?
    
    @Parent(key: "author_id")
    var author: User
    
    @Parent(key: "chat_id")
    var chat: Chat
    
    required init() {}
    
    init(
        id: UUID? = nil,
        localId: UUID,
        authorId: UserID,
        chatId: UUID,
        text: String?,
        fileType: String? = nil,
        fileSize: Int64? = nil,
        previewWidth: Int? = nil,
        previewHeight: Int? = nil
    ) {
        self.id = id
        self.localId = localId
        self.$author.id = authorId
        self.$chat.id = chatId
        self.text = text
        self.fileType = fileType
        self.fileSize = fileSize
        self.previewWidth = previewWidth
        self.previewHeight = previewHeight
    }
}

extension Message {
    
    struct Info: Serializable {
        var id: UUID?
        var localId: UUID?
        var chatId: UUID?
        var authorId: UserID?
        
        var text: String?
        var fileType: String?
        var fileSize: Int64?
        var previewWidth: Int?
        var previewHeight: Int?
        var createdAt: Date?
        var updatedAt: Date?
        var readAt: Date?
        var isVisible: Bool?
        
        init(from message: Message) {
            self.id = message.id
            self.localId = message.localId
            self.chatId = message.$chat.id
            self.authorId = message.$author.id
            self.text = message.text
            self.fileType = message.fileType
            self.fileSize = message.fileSize
            self.previewWidth = message.previewWidth
            self.previewHeight = message.previewHeight
            self.createdAt = message.createdAt
            self.updatedAt = message.updatedAt
            self.readAt = message.readAt
            self.isVisible = message.isVisible
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}

typealias MessageInfo = Message.Info
