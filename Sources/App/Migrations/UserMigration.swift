import Fluent

extension User {
    struct Migration: AsyncMigration {
        var name: String { "UserMigration" }

        func prepare(on database: Database) async throws {
            try await database.schema("users")
                .field(.id, .uint32, .identifier(auto: true))
                .field("name", .string, .required)
                .field("username", .string, .required)
                .field("about", .string)
                .field("last_access", .datetime)
                .field("password_hash", .string, .required)
                .field("key_hash", .string)
                .unique(on: "username")
                .create()
        }
        
        func revert(on database: Database) async throws {
            try await database.schema("users").delete()
        }
    }
}
