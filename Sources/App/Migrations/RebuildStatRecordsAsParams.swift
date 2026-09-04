import Fluent
import Foundation

/// `stat_records` used to be one wide row per 24-hour window: four named
/// columns, and a new figure meant a new column and a new migration. It is one
/// row per parameter now — see `TelemetryParam` — which is what lets the server
/// track total-versus-user requests without touching the schema again.
///
/// The old row's values are carried over rather than dropped: the counts are
/// lifetime figures, and a dashboard whose total falls back to zero after a
/// deploy is reporting a lie about the server's history.
struct RebuildStatRecordsAsParams: AsyncMigration {
    var name: String { "RebuildStatRecordsAsParams" }

    func prepare(on database: Database) async throws {
        // Read before dropping. A fresh database has the old table (the earlier
        // migrations just created it) but no rows, which is the same as having
        // nothing to carry over.
        let legacy = try? await LegacyStatRecord.query(on: database)
            .sort(\.$createdAt, .descending)
            .first()

        try await database.schema(StatRecord.schema).delete()
        try await database.schema(StatRecord.schema)
            .id()
            .field("telemetry_param", .string, .required)
            .field("value", .double, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .unique(on: "telemetry_param")
            .create()

        for (param, value) in Self.seed(from: legacy) {
            try await StatRecord(param: param, value: value).save(on: database)
        }
    }

    /// Reverting restores the shape, not the data: the old table held one row
    /// per window and this one holds none of that structure, so there is nothing
    /// faithful to write back.
    func revert(on database: Database) async throws {
        try await database.schema(StatRecord.schema).delete()
        try await database.schema(StatRecord.schema)
            .id()
            .field("max_requests_per_second", .double, .required)
            .field("max_messages_per_second", .double, .required)
            .field("total_requests", .int, .required)
            .field("total_messages", .int, .required)
            .field("created_at", .datetime)
            .field("updated_at", .datetime)
            .create()
    }

    /// Every param gets a row, so the table describes what the server tracks
    /// even on a database that has never seen traffic.
    ///
    /// Two judgement calls:
    ///   • `userRequestsCount` is seeded from the old total. That total counted
    ///     telemetry polls too — the split did not exist yet — so the carried
    ///     figure is an upper bound. Seeding zero instead would have been a
    ///     lifetime counter visibly restarting, which is the worse lie.
    ///   • the old peak was a 24h-window high, so it becomes today's peak only
    ///     when that window was opened today; otherwise today starts unset and
    ///     the first sample earns it.
    static func seed(from legacy: LegacyStatRecord?, now: Date = Date()) -> [(TelemetryParam, Double)] {
        guard let legacy else {
            return TelemetryParam.allCases.map { ($0, 0) }
        }
        let fromToday = legacy.createdAt.map { Calendar.utc.isDate($0, inSameDayAs: now) } ?? false
        return [
            (.maxRequestsPerSecond, legacy.maxRequestsPerSecond),
            (.dailyPeakRequestsPerSecond, fromToday ? legacy.maxRequestsPerSecond : 0),
            (.totalRequestsCount, Double(legacy.totalRequests)),
            (.userRequestsCount, Double(legacy.totalRequests)),
            (.maxMessagesPerSecond, legacy.maxMessagesPerSecond),
            (.dailyPeakMessagesPerSecond, fromToday ? legacy.maxMessagesPerSecond : 0),
            (.totalMessagesCount, Double(legacy.totalMessages)),
        ]
    }
}

/// The pre-refactor `stat_records` shape, kept alive only long enough to read
/// the last row out of it. `StatRecord` itself already describes the new table,
/// so the migration cannot use it to read the old one.
final class LegacyStatRecord: Model, @unchecked Sendable {
    static let schema = "stat_records"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "max_requests_per_second")
    var maxRequestsPerSecond: Double

    @Field(key: "max_messages_per_second")
    var maxMessagesPerSecond: Double

    @Field(key: "total_requests")
    var totalRequests: Int

    @Field(key: "total_messages")
    var totalMessages: Int

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}
}
