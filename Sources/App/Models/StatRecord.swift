import Fluent
import Foundation

typealias StatRecordID = UUID

/// Every telemetry figure the server persists, one case per row in
/// `stat_records`.
///
/// Two kinds live here and they are written under different rules:
///
///   • **counts** (`totalRequestsCount`, `userRequestsCount`,
///     `totalMessagesCount`) are lifetime running totals. They carry across
///     restarts — the in-memory counters are seeded from these rows at launch —
///     and are rewritten whenever they move.
///   • **peaks** (`max…PerSecond`, `dailyPeak…PerSecond`) are highs, so a row is
///     only touched when a new record arrives. `max…` is the all-time high;
///     `dailyPeak…` is today's, and a row whose `updatedAt` falls on an earlier
///     day is stale by definition — the day rolled over without a new high, so
///     the reader treats it as zero and the next high overwrites it.
///
/// Peaks measure **user** requests, not total ones: everything the dashboard
/// labels a peak is meant to describe real traffic, and telemetry polling is a
/// fixed background drip that would otherwise set the floor.
enum TelemetryParam: String, CaseIterable, Sendable {
    /// All-time high of user requests per second.
    case maxRequestsPerSecond
    /// Today's high of user requests per second.
    case dailyPeakRequestsPerSecond
    /// Lifetime requests, `/telemetry` polling included.
    case totalRequestsCount
    /// Lifetime requests with `/telemetry` polling excluded.
    case userRequestsCount
    /// All-time high of messages posted per second.
    case maxMessagesPerSecond
    /// Today's high of messages posted per second.
    case dailyPeakMessagesPerSecond
    /// Lifetime count of messages users posted.
    case totalMessagesCount

    /// Highs only move up, and only within their window; counts are rewritten
    /// whenever they change.
    var isPeak: Bool {
        switch self {
        case .maxRequestsPerSecond, .dailyPeakRequestsPerSecond,
             .maxMessagesPerSecond, .dailyPeakMessagesPerSecond:
            return true
        case .totalRequestsCount, .userRequestsCount, .totalMessagesCount:
            return false
        }
    }

    /// A daily peak belongs to the calendar day it was last written on; an
    /// all-time peak belongs to no window at all.
    var isDaily: Bool {
        self == .dailyPeakRequestsPerSecond || self == .dailyPeakMessagesPerSecond
    }
}

/// One telemetry parameter. The table holds a handful of rows — one per
/// `TelemetryParam` — rather than one wide row per time window, so adding a
/// figure is a new case here and nothing else: no migration, no column, and no
/// rewriting of what the other figures mean.
///
/// `value` is a Double for every param, counts included. A count is always a
/// whole number and reads back as one; giving peaks their own column type would
/// have split the table in two to save a cast.
final class StatRecord: RepositoryItem, @unchecked Sendable {
    static let schema = "stat_records"

    @ID(key: .id)
    var id: StatRecordID?

    /// The `TelemetryParam` raw value. Unique — one row per param.
    @Field(key: "telemetry_param")
    var telemetryParam: String

    /// The stored figure: a rate for peaks, a running total for counts.
    @Field(key: "value")
    var value: Double

    /// When this param was first recorded — for daily peaks, effectively when
    /// the server first ran.
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    /// When the figure last moved. This is what dates a daily peak: no separate
    /// day column is needed because a high that was last written yesterday is
    /// exactly a high that does not belong to today.
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    init(param: TelemetryParam, value: Double) {
        self.telemetryParam = param.rawValue
        self.value = value
    }

    var param: TelemetryParam? {
        TelemetryParam(rawValue: telemetryParam)
    }

    /// Whether the stored figure was last written on `now`'s calendar day.
    /// UTC throughout, matching the UNIX timestamps the API speaks — a server
    /// and a dashboard in different zones must agree on when "today" started.
    func isFromToday(_ now: Date = Date()) -> Bool {
        guard let stamp = updatedAt ?? createdAt else { return false }
        return Calendar.utc.isDate(stamp, inSameDayAs: now)
    }
}

extension Calendar {
    /// The API speaks UNIX timestamps and the dashboard may sit anywhere, so the
    /// day boundary is UTC rather than whatever zone the host happens to run in.
    ///
    /// Computed rather than stored: building a `Calendar` costs nothing next to
    /// a database round trip, and a stored global would be one more piece of
    /// shared state to reason about under strict concurrency.
    static var utc: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        return calendar
    }
}
