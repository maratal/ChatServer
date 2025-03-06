import Fluent

struct CreateMediaResource: AsyncMigration {
    var name: String { "CreateMediaResource" }

    func prepare(on database: Database) async throws {
        try await database.schema("media_resources")
            .id()
            .field("file_type", .string)
            .field("file_size", .int64)
            .field("preview_width", .int16)
            .field("preview_height", .int16)
            .field("created_at", .datetime, .required)
            .field("photo_of", .uint32, .references("users", "id", onDelete: .setNull))
            .field("image_of", .uuid, .references("chats", "id", onDelete: .setNull))
            .field("attachment_of", .uint64, .references("messages", "id", onDelete: .setNull))
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("media_resources").delete()
    }
}
