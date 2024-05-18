import Fluent

struct CreateUser: AsyncMigration {
    var name: String { "CreateUser" }

    func prepare(on database: Database) async throws {
        try await database.schema("users")
            .field(.id, .uint32, .identifier(auto: true))
            .field("name", .string, .required)
            .field("username", .string, .required)
            .field("about", .string)
            .field("last_access", .datetime)
            .field("password_hash", .string, .required)
            .field("account_key_hash", .string)
            .field("created_at", .datetime, .required)
            .field("updated_at", .datetime)
            .unique(on: "username")
            .create()
    }
    
    func revert(on database: Database) async throws {
        try await database.schema("users").delete()
    }
}
