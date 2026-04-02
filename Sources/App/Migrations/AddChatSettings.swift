import Fluent

struct AddChatSettings: AsyncMigration {
    var name: String { "AddChatSettings" }

    func prepare(on database: Database) async throws {
        try await database.schema("chats")
            .field("settings", .string)
            .update()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("chats")
            .deleteField("settings")
            .update()
    }
}
