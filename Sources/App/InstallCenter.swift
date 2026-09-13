import Fluent
import FluentPostgresDriver     // for SQLKit: the flush is one statement, not one per row
import Vapor

/// Who is using the app, counted by cookie.
///
/// Every user request carries an `install_id` the app issued the first time it
/// saw that browser (see `TelemetryMiddleware`). The map here is the live view —
/// one entry per cookie, holding when it was last seen and the hits not yet
/// written — and `installs` is the durable one, written on the persistence cycle
/// rather than once a request, in a single statement however many installs it
/// carries.
///
/// Entries carry a delta rather than a running total on purpose: the stored row
/// is the lifetime figure, and a process that started ten minutes ago must add
/// to it, not overwrite it with its own short count.
actor InstallCenter {
    static let shared = InstallCenter()

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

    /// One request under one cookie.
    func record(_ installID: String, at now: Date = Date()) {
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
    func restore(on database: Database, now: Date = Date()) async throws {
        totalUsers = try await Install.query(on: database).count()
        let since = now.addingTimeInterval(-Self.activeWindow)
        let recent = try await Install.query(on: database)
            .filter(\.$updatedAt >= since)
            .all()
        for row in recent {
            entries[row.installID] = Entry(lastSeen: row.updatedAt ?? now, pending: 0)
        }
    }

    /// `VALUES` rows per statement. Anything from a hundred rows up performs the
    /// same, so this is near the low end of what works: enough to batch, short
    /// enough that one statement is milliseconds.
    private static let batchSize = 500

    /// Write the pending hits.
    ///
    /// One statement per flush, not one per install. Fluent has no batched
    /// update and no upsert — a loop of `save` is two round trips and a separate
    /// transaction per row, so a hundred new visitors would cost a hundred
    /// commits — and this is a single `INSERT … ON CONFLICT DO UPDATE`: one
    /// parse, one round trip, one commit, whether it carries one install or five
    /// hundred.
    ///
    /// The addition is done by the database (`installs.request_count +
    /// EXCLUDED.request_count`) rather than read-modify-written in Swift, so the
    /// figure is right even if something else is writing the same row.
    func flush(on database: Database, now: Date = Date()) async throws {
        let batch: [(installID: String, pending: Int)] = entries.compactMap { id, entry in
            guard entry.pending > 0 else { return nil }
            return (installID: id, pending: entry.pending)
        }
        defer { prune(seenSince: now.addingTimeInterval(-Self.activeWindow)) }
        guard !batch.isEmpty else { return }

        guard let sql = database as? any SQLDatabase else {
            // A database with no SQL dialect behind it — a stub in a test. Slower
            // by a round trip per row, and says exactly the same thing.
            try await flushRowByRow(batch, on: database)
            return
        }

        // Walk the batch a statement at a time. One is the ordinary case; the
        // loop is here for the cycle that catches a crowd. See `batchSize` for more.
        var start = batch.startIndex
        while start < batch.endIndex {
            let end = batch.index(start, offsetBy: Self.batchSize, limitedBy: batch.endIndex) ?? batch.endIndex
            try await upsert(Array(batch[start..<end]), on: sql, now: now)
            start = end
        }
    }

    private func upsert(
        _ batch: [(installID: String, pending: Int)],
        on sql: any SQLDatabase,
        now: Date
    ) async throws {
        var query: SQLQueryString =
            "INSERT INTO \(ident: Install.schema) (id, install_id, request_count, created_at, updated_at) VALUES "
        for (offset, row) in batch.enumerated() {
            if offset > 0 { query += ", " }
            query += "(\(bind: UUID()), \(bind: row.installID), \(bind: row.pending), \(bind: now), \(bind: now))"
        }
        query += " ON CONFLICT (install_id) DO UPDATE SET request_count = "
        query += "\(ident: Install.schema).request_count + EXCLUDED.request_count, updated_at = EXCLUDED.updated_at"
        // `xmax` is zero on a row this statement inserted and non-zero on one it
        // updated, which is how the lifetime figure stays exact without a
        // COUNT(*) over a table that only grows.
        query += " RETURNING (xmax = 0) AS inserted"

        let written = try await sql.raw(query).all()
        for row in written where (try? row.decode(column: "inserted", as: Bool.self)) == true {
            totalUsers += 1
        }

        // Subtracted rather than zeroed, and only once the statement has
        // returned: the flush suspends, so hits counted while it ran must
        // survive it — and a thrown write leaves them in place for the next one.
        for row in batch {
            entries[row.installID]?.pending -= row.pending
        }
    }

    /// The row-at-a-time path, for a database that is not SQL-backed.
    private func flushRowByRow(
        _ batch: [(installID: String, pending: Int)],
        on database: Database
    ) async throws {
        for row in batch {
            if let stored = try await Install.query(on: database)
                .filter(\.$installID == row.installID)
                .first() {
                stored.requestCount += row.pending
                try await stored.save(on: database)
            } else {
                try await Install(installID: row.installID, requestCount: row.pending).save(on: database)
                totalUsers += 1
            }
            entries[row.installID]?.pending -= row.pending
        }
    }

    /// An install nobody has seen for a day is only holding memory: its count is
    /// on disk and it is outside the window the figures describe. One still
    /// carrying unwritten hits stays until they are written.
    private func prune(seenSince: Date) {
        entries = entries.filter { $0.value.lastSeen >= seenSince || $0.value.pending > 0 }
    }
}
