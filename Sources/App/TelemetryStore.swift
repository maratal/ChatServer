import Fluent
import FluentPostgresDriver     // for SQLKit: the params are written in one statement
import Vapor

/// One param as the table holds it.
struct StoredParam: Sendable {
    let value: Double
    let writtenAt: Date
}

/// The database side of the telemetry figures: reading the table at launch, and
/// writing the params it is given.
///
/// It holds nothing of its own — `TelemetryRecorder` has the figures, and
/// decides which of them are worth writing. This is only the SQL.
actor TelemetryStore {
    static let shared = TelemetryStore()

    /// Every stored param, with the value and the date it was last written.
    /// What that means — which of them are today's, which read as stale — is the
    /// recorder's business.
    func load(on database: any Database, now: Date) async throws -> [TelemetryParam: StoredParam] {
        let stored = try await StatRecord.query(on: database).all()
        var rows: [TelemetryParam: StoredParam] = [:]
        for row in stored {
            guard let param = row.param else { continue }   // a param this build no longer knows
            rows[param] = StoredParam(value: row.value, writtenAt: row.updatedAt ?? row.createdAt ?? now)
        }
        return rows
    }

    /// Write the params it is given, in one statement whatever the count.
    func write(
        _ due: [(param: TelemetryParam, value: Double)],
        on database: any Database,
        now: Date
    ) async throws {
        guard !due.isEmpty else { return }

        if let sql = database as? any SQLDatabase {
            try await upsert(due, on: sql, now: now)
        } else {
            // A database with no SQL dialect behind it — a stub in a test. Slower
            // by a round trip per row, and says exactly the same thing.
            try await writeRowByRow(due, on: database)
        }
    }

    private func upsert(
        _ due: [(param: TelemetryParam, value: Double)],
        on sql: any SQLDatabase,
        now: Date
    ) async throws {
        var query: SQLQueryString =
            "INSERT INTO \(ident: StatRecord.schema) (id, telemetry_param, value, created_at, updated_at) VALUES "
        for (offset, row) in due.enumerated() {
            if offset > 0 { query += ", " }
            query += "(\(bind: UUID()), \(bind: row.param.rawValue), \(bind: row.value), \(bind: now), \(bind: now))"
        }
        query += " ON CONFLICT (telemetry_param) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at"
        try await sql.raw(query).run()
    }

    private func writeRowByRow(
        _ due: [(param: TelemetryParam, value: Double)],
        on database: any Database
    ) async throws {
        for item in due {
            let row = try await StatRecord.query(on: database)
                .filter(\.$telemetryParam == item.param.rawValue)
                .first() ?? StatRecord(param: item.param, value: item.value)
            row.value = item.value
            try await row.save(on: database)
        }
    }
}
