import Fluent
import Foundation

final class MessageToMedia: Model, RepositoryItem, @unchecked Sendable {
    static let schema = "message_to_media"

    @ID(key: .id)
    var id: UUID?

    @Parent(key: "message_id")
    var message: Message

    @Parent(key: "media_resource_id")
    var mediaResource: MediaResource

    @Field(key: "position")
    var position: Int

    required init() {}

    init(id: UUID? = nil, messageId: MessageID, mediaResourceId: ResourceID, position: Int = 0) {
        self.id = id
        self.$message.id = messageId
        self.$mediaResource.id = mediaResourceId
        self.position = position
    }
}
