import Fluent

struct CreateStatRecord: AsyncMigration {
    var name: String { "CreateStatRecord" }

    func prepare(on database: Database) async throws {
        try await database.schema("stat_records")
            .id()
            .field("max_requests_per_second", .int, .required)
            .field("max_messages_per_second", .int, .required)
            .field("total_requests", .int, .required)
            .field("total_messages", .int, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("stat_records").delete()
    }
}
