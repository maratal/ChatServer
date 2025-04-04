import Fluent
import Foundation

final class MediaResource: RepositoryItem, @unchecked Sendable /* https://blog.vapor.codes/posts/fluent-models-and-sendable */ {
    static let schema = "media_resources"
    
    @ID(key: .id)
    var id: ResourceID?
    
    @Field(key: "file_type")
    var fileType: String
    
    @Field(key: "file_size")
    var fileSize: Int64
    
    @Field(key: "preview_width")
    var previewWidth: Int
    
    @Field(key: "preview_height")
    var previewHeight: Int
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @OptionalParent(key: "photo_of")
    var photoOf: User?
    
    @OptionalParent(key: "image_of")
    var imageOf: Chat?
    
    @OptionalParent(key: "attachment_of")
    var attachmentOf: Message?
    
    required init() {}
    
    init(
        id: ResourceID? = nil,
        photoOf userId: UserID? = nil,
        imageOf chatId: ChatID? = nil,
        attachmentOf messageId: MessageID? = nil,
        fileType: String,
        fileSize: Int64,
        previewWidth: Int,
        previewHeight: Int
    ) {
        self.id = id
        self.$photoOf.id = userId
        self.$imageOf.id = chatId
        self.$attachmentOf.id = messageId
        self.fileType = fileType
        self.fileSize = fileSize
        self.previewWidth = previewWidth
        self.previewHeight = previewHeight
    }
}

extension MediaResource {
    
    struct Info: Serializable {
        var id: ResourceID?
        var fileType: String
        var fileSize: Int64
        var previewWidth: Int?
        var previewHeight: Int?
        var createdAt: Date?
        
        init(id: ResourceID? = nil, fileType: String, fileSize: Int64) {
            self.id = id
            self.fileType = fileType
            self.fileSize = fileSize
        }
        
        init(from media: MediaResource) {
            self.id = media.id
            self.fileType = media.fileType
            self.fileSize = media.fileSize
            self.previewWidth = media.previewWidth
            self.previewHeight = media.previewHeight
            self.createdAt = media.createdAt
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}

typealias MediaInfo = MediaResource.Info
