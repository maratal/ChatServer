import Fluent

extension User {
    struct Migration: AsyncMigration {
        var name: String { "UserMigration" }

        func prepare(on database: Database) async throws {
            try await database.schema("users")
                .id()
                .field("name", .string, .required)
                .field("username", .string, .required)
                .field("password_hash", .string, .required)
                .unique(on: "username")
                .create()
        }
        
        func revert(on database: Database) async throws {
            try await database.schema("users").delete()
        }
    }
}
