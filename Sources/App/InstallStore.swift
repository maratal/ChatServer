import Fluent
import FluentPostgresDriver     // for SQLKit: a flush is one statement, not one per row
import Vapor

/// The database side of the install figures: reading the table at launch, and
/// writing a batch of hits.
///
/// It holds nothing of its own — `InstallRecorder` has the map, and decides what
/// is worth writing. This is only the SQL.
actor InstallStore {
    static let shared = InstallStore()

    /// The row count, and the installs seen since `since`.
    func load(
        on database: any Database,
        since: Date
    ) async throws -> (total: Int, recent: [(installID: String, lastSeen: Date)]) {
        let total = try await Install.query(on: database).count()
        let rows = try await Install.query(on: database)
            .filter(\.$updatedAt >= since)
            .all()
        return (total, rows.compactMap { row in
            row.updatedAt.map { (installID: row.installID, lastSeen: $0) }
        })
    }

    /// Add a batch of hits, and report how many installs were new.
    ///
    /// One statement, whatever the batch carries. Fluent has no batched update
    /// and no upsert — a loop of `save` is two round trips and a separate
    /// transaction per row, so a hundred new visitors would cost a hundred
    /// commits.
    ///
    /// The addition is done by the database (`installs.request_count +
    /// EXCLUDED.request_count`) rather than read-modify-written in Swift, so the
    /// figure is right even if something else is writing the same row.
    @discardableResult
    func write(
        _ batch: [(installID: String, pending: Int)],
        on database: any Database,
        now: Date
    ) async throws -> Int {
        guard !batch.isEmpty else { return 0 }

        if let sql = database as? any SQLDatabase {
            return try await upsert(batch, on: sql, now: now)
        } else {
            // A database with no SQL dialect behind it — a stub in a test. Slower
            // by a round trip per row, and says exactly the same thing.
            return try await writeRowByRow(batch, on: database)
        }
    }

    private func upsert(
        _ batch: [(installID: String, pending: Int)],
        on sql: any SQLDatabase,
        now: Date
    ) async throws -> Int {
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
        return written.filter { (try? $0.decode(column: "inserted", as: Bool.self)) == true }.count
    }

    private func writeRowByRow(
        _ batch: [(installID: String, pending: Int)],
        on database: any Database
    ) async throws -> Int {
        var inserted = 0
        for row in batch {
            if let stored = try await Install.query(on: database)
                .filter(\.$installID == row.installID)
                .first() {
                stored.requestCount += row.pending
                try await stored.save(on: database)
            } else {
                try await Install(installID: row.installID, requestCount: row.pending).save(on: database)
                inserted += 1
            }
        }
        return inserted
    }
}
