import Fluent

struct AddLanguageToMessage: AsyncMigration {
    var name: String { "AddLanguageToMessage" }

    func prepare(on database: Database) async throws {
        try await database.schema("messages")
            .field("language", .string)
            .update()
    }

    func revert(on database: Database) async throws {
        try await database.schema("messages")
            .deleteField("language")
            .update()
    }
}
