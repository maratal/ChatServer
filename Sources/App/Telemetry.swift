import Vapor

/// Visual telemetry — live request/connection/message counters exposed at:
///
///     GET https://<app>/telemetry
///
/// Snapshot shape: { rrc, wscc, wsmc } — three bare numbers.
///   rrc: REST requests since launch (cumulative counter)
///   wscc: open websocket connections (current level)
///   wsmc: incoming ws messages since launch (cumulative counter)
///
/// The app keeps no history at all: it reports the counters as they stand and
/// the dashboard does the rest. Each poll it stores (timestamp, counter)
/// locally and derives a rate by differencing consecutive samples — so the
/// sampling interval is whatever the dashboard's poll interval happens to be,
/// and the app never has to guess how the numbers will be charted.
struct TelemetrySnapshot: Content {
    let rrc: Int
    let wscc: Int
    let wsmc: Int
}

/// All mutable telemetry state lives in this actor — reads and writes are
/// serialized by the actor executor, which is the thread synchronization for
/// concurrent request/websocket handlers.
actor TelemetryCenter {
    static let shared = TelemetryCenter()

    private var restTotal = 0
    private var wsMsgTotal = 0
    private var wsConnections = 0

    func countRequest() {
        restTotal += 1
    }

    func countWsMessage() {
        wsMsgTotal += 1
    }

    func wsOpened() {
        wsConnections += 1
    }

    func wsClosed() {
        wsConnections = max(0, wsConnections - 1)
    }

    func snapshot() -> TelemetrySnapshot {
        TelemetrySnapshot(rrc: restTotal, wscc: wsConnections, wsmc: wsMsgTotal)
    }
}

/// Counts every REST request.
struct TelemetryMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        Task { await TelemetryCenter.shared.countRequest() }
        return try await next.respond(to: request)
    }
}

/// The `/telemetry` endpoint. Public, like `/api/info`.
/// The dashboard polls it on its status tick.
func telemetryRoutes(_ app: Application) {
    app.get("telemetry") { request async throws -> Response in
        try await TelemetryCenter.shared.snapshot().encodeResponse(for: request)
    }
}
