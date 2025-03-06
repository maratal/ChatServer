import Fluent

struct CreateReaction: AsyncMigration {
    var name: String { "CreateReadMark" }

    func prepare(on database: Database) async throws {
        try await database.schema("read_marks")
            .id()
            .field("created_at", .datetime)
            .field("user_id", .uint32, .required, .references("users", "id", onDelete: .cascade))
            .field("message_id", .uint64, .required, .references("messages", "id", onDelete: .cascade))
            .unique(on: "user_id", "message_id")
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("read_marks").delete()
    }
}
