import Fluent

struct CreateMediaResource: AsyncMigration {
    var name: String { "CreateMediaResource" }

    func prepare(on database: Database) async throws {
        try await database.schema("media_resources")
            .id()
            .field("owner_id", .uint32, .references("users", "id", onDelete: .setNull))
            .field("file_type", .string)
            .field("file_size", .int64)
            .field("preview_width", .int16)
            .field("preview_height", .int16)
            .field("created_at", .datetime, .required)
            .field("uploaded_at", .datetime)
            .field("photo_of", .uint32, .references("users", "id", onDelete: .setNull))
            .field("image_of", .uuid, .references("chats", "id", onDelete: .setNull))
            .field("duration", .double)
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("media_resources").delete()
    }
}
