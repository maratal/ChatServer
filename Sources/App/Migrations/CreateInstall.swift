import Fluent

/// `installs` — one row per `install_id` cookie, with the requests served under
/// it. Unique on the cookie: the flush looks a row up by it on every write.
struct CreateInstall: AsyncMigration {
    var name: String { "CreateInstall" }

    func prepare(on database: Database) async throws {
        try await database.schema(Install.schema)
            .id()
            .field("install_id", .string, .required)
            .field("request_count", .int, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .unique(on: "install_id")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema(Install.schema).delete()
    }
}
