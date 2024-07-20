import Fluent

struct CreateDeviceSession: AsyncMigration {
    var name: String { "CreateDeviceSession" }
    
    func prepare(on database: Database) async throws {
        try await database.schema("device_sessions")
            .id()
            .field("user_id", .uint32, .required, .references("users", "id", onDelete: .cascade))
            .field("ip_address", .string)
            .field("device_id", .string, .required)
            .field("device_name", .string, .required)
            .field("device_model", .string, .required)
            .field("device_token", .string)
            .field("access_token", .string, .required)
            .field("push_transport", .string)
            .field("created_at", .datetime, .required)
            .field("updated_at", .datetime)
            .unique(on: "access_token")
            .create()
    }

    func revert(on database: Database) async throws {
        try await database.schema("device_sessions").delete()
    }
}
