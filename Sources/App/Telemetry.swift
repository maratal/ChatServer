import Vapor

/// Visual telemetry — live request/connection/message counters exposed at:
///
///     GET https://<app>/telemetry
///
/// Snapshot shape: { rrc, wscc, wsmc }
///   rrc: REST request counts ([[unix_ts, cumulative_count], ...])
///   wscc: open websocket connections (number)
///   wsmc: incoming ws message counts ([[unix_ts, cumulative_count], ...])
///
/// The count series is a dict<unix_ts, counter-since-launch> capped at 20
/// entries (newest added, oldest evicted); a hit within an already-present
/// second just bumps that second's counter snapshot.
struct TelemetrySnapshot: Content {
    let rrc: [[Int]]
    let wscc: Int
    let wsmc: [[Int]]
}

/// All mutable telemetry state lives in this actor — reads and writes are
/// serialized by the actor executor, which is the thread synchronization for
/// concurrent request/websocket handlers.
actor TelemetryCenter {
    static let shared = TelemetryCenter()

    private static let maxPoints = 20

    private var restTotal = 0
    private var restPoints: [[Int]] = []      // [unix_ts, counter since launch]
    private var wsMsgTotal = 0
    private var wsMsgPoints: [[Int]] = []
    private var wsConnections = 0

    private func hit(_ points: inout [[Int]], total: Int) {
        let ts = Int(Date().timeIntervalSince1970)
        if let last = points.last, last[0] == ts {
            points[points.count - 1][1] = total
        } else {
            points.append([ts, total])
            if points.count > Self.maxPoints {
                points.removeFirst(points.count - Self.maxPoints)
            }
        }
    }

    func countRequest() {
        restTotal += 1
        hit(&restPoints, total: restTotal)
    }

    func countWsMessage() {
        wsMsgTotal += 1
        hit(&wsMsgPoints, total: wsMsgTotal)
    }

    func wsOpened() {
        wsConnections += 1
    }

    func wsClosed() {
        wsConnections = max(0, wsConnections - 1)
    }

    func snapshot() -> TelemetrySnapshot {
        TelemetrySnapshot(rrc: restPoints, wscc: wsConnections, wsmc: wsMsgPoints)
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
