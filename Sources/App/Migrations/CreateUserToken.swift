import Fluent

struct CreateUserToken: AsyncMigration {
    var name: String { "CreateUserToken" }

    func prepare(on database: Database) async throws {
        try await database.schema("user_tokens")
            .id()
            .field("value", .string, .required)
            .field("user_id", .uint32, .required, .references("users", "id", onDelete: .cascade))
            .unique(on: "value")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("user_tokens").delete()
    }
}
