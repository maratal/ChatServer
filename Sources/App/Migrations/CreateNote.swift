import Fluent

struct CreateNote: AsyncMigration {
    var name: String { "CreateNote" }

    func prepare(on database: Database) async throws {
        try await database.schema("notes")
            .id()
            .field("source_id", .uint64, .required, .references("messages", "id", onDelete: .cascade))
            .field("created_at", .datetime)
            .unique(on: "source_id")
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("notes").delete()
    }
}
