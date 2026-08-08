import Fluent

/// The peak columns started as integers, which forced every fractional rate to
/// be rounded before it could be stored: a quiet app peaking at 0.2 req/s had to
/// be written as either 0 (no traffic at all) or 1 (five times what it saw).
/// Both are wrong, so the columns hold the measured value now.
///
/// Existing rows keep their values — Postgres widens int to double precision
/// without a cast, and a peak that was stored as 1 stays 1.
struct AlterStatRecordPeaksToDouble: AsyncMigration {
    var name: String { "AlterStatRecordPeaksToDouble" }

    func prepare(on database: Database) async throws {
        try await database.schema("stat_records")
            .updateField("max_requests_per_second", .double)
            .updateField("max_messages_per_second", .double)
            .update()
    }

    /// Reverting is lossy: Postgres rounds each value to the nearest integer on
    /// the way back, so anything under 0.5/s becomes a zero.
    func revert(on database: Database) async throws {
        try await database.schema("stat_records")
            .updateField("max_requests_per_second", .int)
            .updateField("max_messages_per_second", .int)
            .update()
    }
}
