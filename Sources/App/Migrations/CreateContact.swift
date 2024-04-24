import Fluent

struct CreateContact: AsyncMigration {
    var name: String { "CreateContact" }

    func prepare(on database: Database) async throws {
        try await database.schema("user_contacts")
            .id()
            .field("name", .string)
            .field("favorite", .bool)
            .field("blocked", .bool)
            .field("user_id", .uint32, .required, .references("users", "id"))
            .field("owner_id", .uint32, .required, .references("users", "id"))
            .unique(on: "user_id", "owner_id")
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("user_contacts").delete()
    }
}
