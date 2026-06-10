import Fluent

struct AddLanguageToUser: AsyncMigration {
    var name: String { "AddLanguageToUser" }

    func prepare(on database: Database) async throws {
        try await database.schema("users")
            .field("language", .string)
            .update()
    }

    func revert(on database: Database) async throws {
        try await database.schema("users")
            .deleteField("language")
            .update()
    }
}
