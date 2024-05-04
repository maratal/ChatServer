import Fluent

struct CreateMessage: AsyncMigration {
    var name: String { "CreateMessage" }

    func prepare(on database: Database) async throws {
        try await database.schema("messages")
            .id()
            .field("local_id", .uuid, .required)
            .field("text", .string)
            .field("file_type", .string)
            .field("file_size", .int64)
            .field("preview_width", .int16)
            .field("preview_height", .int16)
            .field("created_at", .datetime, .required)
            .field("updated_at", .datetime)
            .field("read_at", .datetime)
            .field("edited_at", .datetime)
            .field("is_visible", .bool, .required, .custom("DEFAULT TRUE"))
            .field("author_id", .uint32, .required, .references("users", "id", onDelete: .noAction))
            .field("chat_id", .uuid, .required, .references("chats", "id", onDelete: .cascade))
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("messages").delete()
    }
}
