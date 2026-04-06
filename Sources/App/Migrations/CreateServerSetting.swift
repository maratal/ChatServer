import Fluent

struct CreateServerSetting: AsyncMigration {
    var name: String { "CreateServerSetting" }

    func prepare(on database: Database) async throws {
        try await database.schema("settings")
            .field("name", .string, .identifier(auto: false))
            .field("value", .string, .required)
            .field("updated_at", .datetime)
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("settings").delete()
    }
}
