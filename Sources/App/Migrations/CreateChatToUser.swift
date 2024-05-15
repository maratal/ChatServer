import Fluent

struct CreateChatToUser: AsyncMigration {
    var name: String { "CreateChatToUser" }

    func prepare(on database: Database) async throws {
        try await database.schema("chats_to_users")
            .id()
            .field("chat_id", .uuid, .required, .references("chats", "id", onDelete: .cascade))
            .field("user_id", .uint32, .required, .references("users", "id", onDelete: .setNull))
            .field("muted", .bool, .custom("DEFAULT FALSE"))
            .field("archived", .bool, .custom("DEFAULT FALSE"))
            .field("user_blocked", .bool, .custom("DEFAULT FALSE"))
            .field("chat_blocked", .bool, .custom("DEFAULT FALSE"))
            .field("removed_on_device", .bool, .custom("DEFAULT FALSE"))
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("chats_to_users").delete()
    }
}
