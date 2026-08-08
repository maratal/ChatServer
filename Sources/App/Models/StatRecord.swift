import Fluent
import Foundation

typealias StatRecordID = UUID

/// A 24-hour telemetry window.
///
/// Totals are lifetime — they carry across restarts, because the in-memory
/// counters are seeded from the newest row at launch. The maxima are per window:
/// once a row is older than 24 hours the sampler opens a new one, so a single
/// spike cannot pin the reported peak forever. Old rows are left in place, which
/// leaves a day-by-day history to chart later if that is ever wanted.
final class StatRecord: RepositoryItem, @unchecked Sendable {
    static let schema = "stat_records"

    @ID(key: .id)
    var id: StatRecordID?

    /// Highest requests-per-second seen during this window.
    @Field(key: "max_requests_per_second")
    var maxRequestsPerSecond: Int

    /// Highest incoming-websocket-messages-per-second seen during this window.
    @Field(key: "max_messages_per_second")
    var maxMessagesPerSecond: Int

    /// Lifetime request count, not per window.
    @Field(key: "total_requests")
    var totalRequests: Int

    /// Lifetime incoming websocket message count, not per window.
    @Field(key: "total_messages")
    var totalMessages: Int

    /// Opens the window; a row older than 24 hours is retired for a fresh one.
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    init(
        maxRequestsPerSecond: Int = 0,
        maxMessagesPerSecond: Int = 0,
        totalRequests: Int = 0,
        totalMessages: Int = 0
    ) {
        self.maxRequestsPerSecond = maxRequestsPerSecond
        self.maxMessagesPerSecond = maxMessagesPerSecond
        self.totalRequests = totalRequests
        self.totalMessages = totalMessages
    }
}
