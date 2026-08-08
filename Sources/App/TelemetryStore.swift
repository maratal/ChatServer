import Fluent
import Vapor

/// Persistence and the background tasks behind the telemetry figures.
///
/// Two cadences, deliberately different:
///   • every 5s  — sample the counters into per-second points (memory only)
///   • every 60s — write totals and peaks to the `stat_records` table
///
/// Sampling has to be frequent enough to be worth charting; writing does not,
/// and a database round trip every 5s to persist numbers nobody reads between
/// writes would be waste.
enum TelemetryStore {

    /// How long one stats row covers. Past this the row is retired and a new one
    /// opened, so a reported peak always means "the highest in the last day".
    static let windowSeconds: TimeInterval = 24 * 60 * 60

    static let sampleInterval: Duration = .seconds(5)
    static let persistInterval: Duration = .seconds(60)

    // MARK: - Launch

    /// Seed the in-memory counters from the newest row.
    ///
    /// Totals are restored unconditionally: they are lifetime figures, and
    /// starting them from zero after a restart would make the dashboard's total
    /// fall backwards. Peaks are only restored while the row's window is still
    /// open — an expired window's high belongs to the row, not to today.
    static func restore(on database: Database) async throws {
        guard let latest = try await newestRow(on: database) else { return }
        let windowOpen = !isExpired(latest)
        await TelemetryCenter.shared.restore(
            totalRequests: latest.totalRequests,
            totalMessages: latest.totalMessages,
            peakRps: windowOpen ? latest.maxRequestsPerSecond : 0,
            peakMps: windowOpen ? latest.maxMessagesPerSecond : 0
        )
    }

    // MARK: - Tasks

    /// Detached so it outlives the request that would otherwise own it, and
    /// unstructured on purpose: it should run for the process's lifetime.
    static func startTasks(on app: Application) {
        let database = app.db
        let logger = app.logger

        Task.detached(priority: .background) {
            while !Task.isCancelled {
                try? await Task.sleep(for: sampleInterval)
                await TelemetryCenter.shared.sample()
            }
        }

        Task.detached(priority: .background) {
            while !Task.isCancelled {
                try? await Task.sleep(for: persistInterval)
                do {
                    try await persist(on: database)
                } catch {
                    // A failed write must not kill the loop: the next pass
                    // carries the same cumulative totals, so nothing is lost.
                    logger.report(error: error)
                }
            }
        }
    }

    // MARK: - Writing

    /// One persistence pass.
    ///
    /// Totals are written every time. Maxima only move up, and only within the
    /// row's own window — that is what makes the stored value a 24h peak rather
    /// than an all-time one.
    static func persist(on database: Database, now: Date = Date()) async throws {
        let (totalRequests, totalMessages, peakRps, peakMps) =
            await TelemetryCenter.shared.persistable()

        guard let row = try await newestRow(on: database), !isExpired(row, now: now) else {
            // No row yet, or the window has closed: open a new one. The peaks
            // reset with it, otherwise yesterday's spike would be carried into
            // today's figures.
            await TelemetryCenter.shared.resetPeaksForNewWindow()
            let (_, _, freshRps, freshMps) = await TelemetryCenter.shared.persistable()
            let opened = StatRecord(
                maxRequestsPerSecond: freshRps,
                maxMessagesPerSecond: freshMps,
                totalRequests: totalRequests,
                totalMessages: totalMessages
            )
            try await opened.save(on: database)
            return
        }

        row.maxRequestsPerSecond = max(row.maxRequestsPerSecond, peakRps)
        row.maxMessagesPerSecond = max(row.maxMessagesPerSecond, peakMps)
        row.totalRequests = totalRequests
        row.totalMessages = totalMessages
        try await row.save(on: database)
    }

    // MARK: - Helpers

    static func newestRow(on database: Database) async throws -> StatRecord? {
        try await StatRecord.query(on: database)
            .sort(\.$createdAt, .descending)
            .first()
    }

    /// A row with no createdAt has not been through the database yet; treat it
    /// as open rather than retiring something that was never used.
    static func isExpired(_ row: StatRecord, now: Date = Date()) -> Bool {
        guard let createdAt = row.createdAt else { return false }
        return now.timeIntervalSince(createdAt) > windowSeconds
    }
}
