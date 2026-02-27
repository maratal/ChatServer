import Fluent

struct AddPositionToMessageToMedia: AsyncMigration {
    var name: String { "AddPositionToMessageToMedia" }

    func prepare(on database: Database) async throws {
        try await database.schema("message_to_media")
            .field("position", .int, .required, .sql(.default(0)))
            .update()
    }

    func revert(on database: Database) async throws {
        try await database.schema("message_to_media")
            .deleteField("position")
            .update()
    }
}
