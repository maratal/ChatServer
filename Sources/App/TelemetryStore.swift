import Fluent
import Vapor

/// Everything the telemetry figures need from the database, behind an actor.
///
/// The rows are held in memory once loaded, which is what keeps a 5s cycle from
/// costing a `SELECT` every 5s: the store already knows the stored figure, so a
/// peak that did not move causes no database traffic at all. Only the counts,
/// which move with every request, are written each cycle.
actor StatStore {
    static let shared = StatStore()

    /// One row per param, loaded at launch and mutated in place from then on.
    private var rows: [TelemetryParam: StatRecord] = [:]

    /// Read every stored param, with the date each one was last written.
    ///
    /// Daily peaks come back as zero when their row was last written on an
    /// earlier day: the row is a record of that day, and reporting it as today's
    /// high would carry yesterday's spike into a morning with no traffic in it.
    func restore(
        on database: Database,
        now: Date = Date()
    ) async throws -> (values: [TelemetryParam: Double], recordedAt: [TelemetryParam: Date]) {
        let stored = try await StatRecord.query(on: database).all()
        rows = [:]
        var values: [TelemetryParam: Double] = [:]
        var recordedAt: [TelemetryParam: Date] = [:]
        for row in stored {
            guard let param = row.param else { continue }   // a param this build no longer knows
            rows[param] = row
            let stale = param.isDaily && !row.isFromToday(now)
            values[param] = stale ? 0 : row.value
            if !stale, row.value > 0, let stamp = row.updatedAt ?? row.createdAt {
                recordedAt[param] = stamp
            }
        }
        return (values, recordedAt)
    }

    /// Write what the cycle reported, under each param's own rule.
    func persist(_ values: [TelemetryParam: Double], on database: Database, now: Date = Date()) async throws {
        for param in TelemetryParam.allCases {
            guard let value = values[param] else { continue }
            try await write(value, for: param, on: database, now: now)
        }
    }

    private func write(
        _ value: Double,
        for param: TelemetryParam,
        on database: Database,
        now: Date
    ) async throws {
        let row = try await record(for: param, on: database)

        let shouldWrite: Bool
        if param.isDaily && !row.isFromToday(now) {
            // The stored high belongs to an earlier day, so today's first figure
            // replaces it outright — this is the one case where a peak row moves
            // downwards.
            shouldWrite = true
        } else if param.isPeak {
            shouldWrite = value > row.value
        } else {
            shouldWrite = value != row.value
        }

        guard shouldWrite || row.id == nil else { return }
        row.value = value
        try await row.save(on: database)
    }

    /// Cached row, or the stored one, or a fresh unsaved one — in that order.
    /// The last case is only reached on a database that predates a param.
    private func record(for param: TelemetryParam, on database: Database) async throws -> StatRecord {
        if let cached = rows[param] { return cached }
        let row = try await StatRecord.query(on: database)
            .filter(\.$telemetryParam == param.rawValue)
            .first() ?? StatRecord(param: param, value: 0)
        rows[param] = row
        return row
    }
}

/// Launch and the background cycle behind the telemetry figures.
///
/// One cycle, not two. Measuring and persisting used to run on separate timers —
/// samples every 5s, a write every 60s — which meant a peak could be up to a
/// minute old on disk and a restart in that window lost it. Writing is cheap now
/// that `StatStore` knows what is already stored, so the same pass does both:
/// the moment a record is set, it is saved.
enum TelemetryStore {

    /// Seconds between measurements — see `TelemetryConfig`.
    static var cycleSeconds: Int { TelemetryConfig.cycleSeconds }

    // MARK: - Launch

    /// Seed the in-memory counters from the stored params, and the install map
    /// from the rows seen inside its window.
    static func restore(on database: Database) async throws {
        let (values, recordedAt) = try await StatStore.shared.restore(on: database)
        await TelemetryCenter.shared.restore(values, recordedAt: recordedAt)
        try await InstallCenter.shared.restore(on: database)
    }

    // MARK: - The cycle

    /// Detached so it outlives the request that would otherwise own it, and
    /// unstructured on purpose: it should run for the process's lifetime.
    ///
    /// One loop, two periods. Every cycle takes a measurement — that is what the
    /// dashboard reads, and it never touches the database. Every `persistSeconds`
    /// the same pass writes: the telemetry params, then the install map. They
    /// share a tick rather than a timer each so the two never interleave their
    /// queries, and so the write burst lands in one place instead of drifting
    /// across the minute.
    static func startTasks(on app: Application) {
        let database = app.db
        let logger = app.logger

        Task.detached(priority: .background) {
            /// What the cycles since the last write reported, latest value per
            /// param. Held here rather than written each cycle: a peak set two
            /// cycles ago is still in memory, so nothing is lost by batching,
            /// and a failed write simply leaves this to the next pass.
            var pending: [TelemetryParam: Double] = [:]
            var cyclesSinceWrite = 0

            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(cycleSeconds))
                pending.merge(await TelemetryCenter.shared.tick()) { _, latest in latest }

                cyclesSinceWrite += 1
                guard cyclesSinceWrite >= TelemetryConfig.persistEveryCycles else { continue }
                cyclesSinceWrite = 0

                do {
                    try await StatStore.shared.persist(pending, on: database)
                    pending = [:]
                    try await InstallCenter.shared.flush(on: database)
                } catch {
                    // A failed write must not kill the cycle: counts are
                    // cumulative, peaks are still held in memory and install
                    // hits are kept until they are written, so the next pass
                    // carries everything this one would have.
                    logger.report(error: error)
                }
            }
        }
    }
}
