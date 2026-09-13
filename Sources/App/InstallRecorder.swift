import Fluent
import Vapor

/// Who is using the app, counted by cookie.
///
/// Every user request carries an `install_id` the app issued the first time it
/// saw that browser (see `TelemetryMiddleware`). The map here is the live view —
/// one entry per cookie, holding when it was last seen and the hits not yet
/// written — and `installs` is the durable one, written on the flush cycle rather
/// than once a request. The SQL itself belongs to `InstallStore`.
///
/// Entries carry a delta rather than a running total on purpose: the stored row
/// is the lifetime figure, and a process that started ten minutes ago must add
/// to it, not overwrite it with its own short count.
actor InstallRecorder {
    static let shared = InstallRecorder()

    /// `VALUES` rows per statement. Batching stops paying after about a hundred
    /// rows, and Postgres takes 65535 bound parameters — five a row, so ~13,000.
    static let batchSize = 500

    /// What "today" means here: a rolling 24 hours rather than a calendar day,
    /// so the figure read just after midnight is not an almost empty one.
    static let activeWindow: TimeInterval = 24 * 60 * 60

    private struct Entry {
        var lastSeen: Date
        var pending: Int
    }

    private var entries: [String: Entry] = [:]

    /// Rows in `installs` — the lifetime figure, which is the one thing the map
    /// cannot know: it holds today, not history.
    ///
    /// Counted once at launch and incremented by the flush that inserts a row,
    /// rather than re-counted on every pass: a `COUNT(*)` costs more the longer
    /// the app has been running, which is exactly backwards for something the
    /// cycle does forever.
    private var totalUsers = 0

    /// One request under one cookie. The clock is read here rather than passed
    /// in: a hit is of now, by definition.
    func record(_ installID: String) {
        let now = Date()
        var entry = entries[installID] ?? Entry(lastSeen: now, pending: 0)
        entry.lastSeen = now
        entry.pending += 1
        entries[installID] = entry
    }

    /// What `/telemetry` reports. Today's figure is the map; the total is the
    /// row count, floored by today because an install seen before its first
    /// flush is real even though the table has not heard of it yet.
    func figures(at now: Date = Date()) -> (today: Int, total: Int) {
        let since = now.addingTimeInterval(-Self.activeWindow)
        let today = entries.values.filter { $0.lastSeen >= since }.count
        return (today, max(totalUsers, today))
    }

    /// Seed from the table at launch: the row count, and the rows seen inside
    /// the window so a restart does not report a day with nobody in it.
    func restore(on database: any Database, now: Date = Date()) async throws {
        let stored = try await InstallStore.shared.load(
            on: database,
            since: now.addingTimeInterval(-Self.activeWindow)
        )
        totalUsers = stored.total
        for row in stored.recent {
            entries[row.installID] = Entry(lastSeen: row.lastSeen, pending: 0)
        }
    }

    /// Write the pending hits.
    ///
    /// A chunk at a time, and each one is subtracted as soon as its statement
    /// returns: the flush suspends, so hits counted while it ran must survive
    /// it, and a throw part way through must not make the next pass rewrite what
    /// is already saved.
    func flush(on database: any Database, now: Date = Date()) async throws {
        let batch: [(installID: String, pending: Int)] = entries.compactMap { id, entry in
            guard entry.pending > 0 else { return nil }
            return (installID: id, pending: entry.pending)
        }
        defer { prune(seenSince: now.addingTimeInterval(-Self.activeWindow)) }
        guard !batch.isEmpty else { return }

        // Normally one pass: a flush only splits when more browsers hit the app
        // in a single cycle than one statement carries.
        var start = batch.startIndex
        while start < batch.endIndex {
            let end = batch.index(start, offsetBy: Self.batchSize, limitedBy: batch.endIndex)
                ?? batch.endIndex
            let chunk = Array(batch[start..<end])
            totalUsers += try await InstallStore.shared.write(chunk, on: database, now: now)
            for row in chunk {
                entries[row.installID]?.pending -= row.pending
            }
            start = end
        }
    }

    /// An install nobody has seen for a day is only holding memory: its count is
    /// on disk and it is outside the window the figures describe. One still
    /// carrying unwritten hits stays until they are written.
    private func prune(seenSince: Date) {
        entries = entries.filter { $0.value.lastSeen >= seenSince || $0.value.pending > 0 }
    }
}

extension InstallRecorder: InMemoryData { }
