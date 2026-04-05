import Fluent

struct CreateServerSetting: AsyncMigration {
    var name: String { "CreateServerSetting" }

    func prepare(on database: Database) async throws {
        try await database.schema("settings")
            .id()
            .field("name", .string, .required)
            .field("value", .string, .required)
            .field("updated_at", .datetime)
            .unique(on: "name")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("settings").delete()
    }
}
