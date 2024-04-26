import Fluent

struct CreateChat: AsyncMigration {
    var name: String { "CreateChat" }

    func prepare(on database: Database) async throws {
        try await database.schema("chats")
            .id()
            .field("title", .string)
            .field("is_personal", .bool, .required, .custom("DEFAULT TRUE"))
            .field("participants_key", .string, .required)
            .field("created_at", .datetime, .required)
            .field("updated_at", .datetime, .required)
            .field("owner_id", .uint32, .required, .references("users", "id", onDelete: .setNull))
            .field("last_message_id", .uuid)
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("chats").delete()
    }
}
