import Fluent
import Vapor

/// State the app keeps in memory and writes on a cycle rather than on the
/// request that changed it.
///
/// Counters, peaks and install hits all move far too often to be worth a write
/// each: a request that bumps a total does it in memory, the figures the
/// dashboard reads come from there too, and the database sees one statement per
/// conforming store per pass. Everything here is an actor because that is what
/// makes the in-memory half safe to touch from concurrent request handlers.
protocol InMemoryData: Actor {
    /// Load what the last run left behind. Called once, after migration.
    func restore(on database: any Database, now: Date) async throws

    /// Write what has accumulated since the previous call, and only that.
    /// A store with nothing to say writes nothing.
    func flush(on database: any Database, now: Date) async throws
}

/// The stores, and the cycle that writes them.
///
/// Every `flushSeconds` each store is asked to write what it has accumulated.
/// Nothing else here touches the database: the figures move in memory, and this
/// is the only pass that leaves the process. Measuring runs on its own cycle,
/// elsewhere — see `TelemetryRecorder`.
///
/// Stores are flushed independently rather than in one transaction: each
/// statement commits on its own, so a success is final. A store that has already
/// dropped what it wrote cannot lose it to a rollback caused by another one, and
/// one that throws does not stop the next.
enum InMemoryDataManager {
    static let stores: [any InMemoryData] = [TelemetryRecorder.shared, InstallRecorder.shared]

    /// Seconds between writes. `DATA_FLUSH_SECONDS` overrides.
    ///
    /// This is what a crash costs: at most this many seconds of counts, and a
    /// record set inside the window. Longer than the measurement cycle because
    /// the install writes scale with how many people are using the app, and a
    /// window's worth of one browser's hits coalesces into a single update.
    static let flushSeconds: Int =
        max(1, Environment.get("DATA_FLUSH_SECONDS").flatMap(Int.init(_:)) ?? 30)

    // MARK: - Launch

    static func restore(on database: any Database, now: Date = Date()) async throws {
        for store in stores {
            try await store.restore(on: database, now: now)
        }
    }

    // MARK: - The cycle

    /// Detached so it outlives the caller, and unstructured on purpose: it
    /// should run for the process's lifetime.
    static func start(on app: Application) {
        let database = app.db
        let logger = app.logger

        Task.detached(priority: .background) {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(flushSeconds))

                let now = Date()
                for store in stores {
                    do {
                        try await store.flush(on: database, now: now)
                    } catch {
                        // A failed write must not kill the cycle, or stop the
                        // next store: every store keeps what it could not write
                        // and carries it into the following pass.
                        logger.report(error: error)
                    }
                }
            }
        }
    }
}
