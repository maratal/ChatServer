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
    
    @OptionalField(key: "uploaded_at")
    var uploadedAt: Date?
    
    @OptionalField(key: "duration")
    var duration: Double?
    
    @OptionalParent(key: "owner_id")
    var owner: User?
    
    @OptionalParent(key: "photo_of")
    var photoOf: User?
    
    @OptionalParent(key: "image_of")
    var imageOf: Chat?
    
    @Siblings(through: MessageToMedia.self, from: \.$mediaResource, to: \.$message)
    var messages: [Message]
    
    required init() {}
    
    init(
        id: ResourceID? = nil,
        owner ownerId: UserID? = nil,
        photoOf userId: UserID? = nil,
        imageOf chatId: ChatID? = nil,
        fileType: String,
        fileSize: Int64,
        previewWidth: Int,
        previewHeight: Int,
        uploadedAt: Date?,
        duration: Double? = nil
    ) {
        self.id = id
        self.$owner.id = ownerId
        self.$photoOf.id = userId
        self.$imageOf.id = chatId
        self.fileType = fileType
        self.fileSize = fileSize
        self.previewWidth = previewWidth
        self.previewHeight = previewHeight
        self.uploadedAt = uploadedAt
        self.duration = duration
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
        var uploadedAt: Date?
        var duration: Double?
        
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
            self.uploadedAt = media.uploadedAt
            self.duration = media.duration
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}

typealias MediaInfo = MediaResource.Info
