import Fluent

struct CreateMessageToMedia: AsyncMigration {
    var name: String { "CreateMessageToMedia" }

    func prepare(on database: Database) async throws {
        try await database.schema("message_to_media")
            .id()
            .field("message_id", .uint64, .required, .references("messages", "id", onDelete: .cascade))
            .field("media_resource_id", .uuid, .required, .references("media_resources", "id", onDelete: .cascade))
            .unique(on: "message_id", "media_resource_id")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("message_to_media").delete()
    }
}
