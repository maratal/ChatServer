import Fluent

struct AddIsPinnedToNote: AsyncMigration {
    var name: String { "AddIsPinnedToNote" }

    func prepare(on database: Database) async throws {
        try await database.schema("notes")
            .field("is_pinned", .bool, .required, .custom("DEFAULT FALSE"))
            .update()
    }

    func revert(on database: Database) async throws {
        try await database.schema("notes")
            .deleteField("is_pinned")
            .update()
    }
}
