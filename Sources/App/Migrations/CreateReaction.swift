import Fluent

struct CreateReaction: AsyncMigration {
    var name: String { "CreateReaction" }

    func prepare(on database: Database) async throws {
        try await database.schema("reactions")
            .id()
            .field("badge", .string)
            .field("created_at", .datetime)
            .field("user_id", .uint32, .required, .references("users", "id", onDelete: .cascade))
            .field("message_id", .uuid, .required, .references("messages", "id", onDelete: .cascade))
            .unique(on: "user_id", "message_id", "badge")
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("reactions").delete()
    }
}
