import Vapor

/// Visual telemetry — live request/connection/message counters exposed at:
///
///     GET https://<app>/vtele            one-shot JSON snapshot
///     WSS wss://<app>/vtele              snapshot on connect, then every 5s
///
/// Snapshot shape: { rrc, wscc, wsmc }
///   rrc   REST request counts:        [[unix_ts, cumulative_count], ...]
///   wscc  open websocket connections: number
///   wsmc  incoming ws message counts: [[unix_ts, cumulative_count], ...]
///
/// The count series is a dict<unix_ts, counter-since-launch> capped at 20
/// entries (newest added, oldest evicted); a hit within an already-present
/// second just bumps that second's counter snapshot.
struct VTeleSnapshot: Content {
    let rrc: [[Int]]
    let wscc: Int
    let wsmc: [[Int]]
}

/// All mutable telemetry state lives in this actor — reads and writes are
/// serialized by the actor executor, which is the thread synchronization for
/// concurrent request/websocket handlers.
actor VTeleCenter {
    static let shared = VTeleCenter()

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

    func snapshot() -> VTeleSnapshot {
        VTeleSnapshot(rrc: restPoints, wscc: wsConnections, wsmc: wsMsgPoints)
    }
}

/// Counts every REST request.
struct VTeleMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        Task { await VTeleCenter.shared.countRequest() }
        return try await next.respond(to: request)
    }
}

/// The `/vtele` endpoints. Public, like `/api/info`. Telemetry websockets count
/// into `wscc` themselves (they are real connections), and anything they send
/// counts into `wsmc`.
func vteleRoutes(_ app: Application) {
    // Both endpoints live on GET /vtele. They cannot be registered as two
    // separate routes: Vapor's `webSocket(_:)` is `on(.GET, path)` internally,
    // so a second registration silently overwrites the JSON route in the
    // router trie and every plain GET gets a bodiless 101 instead. One route,
    // branching on the Upgrade header, serves both.
    app.on(.GET, "vtele") { request async throws -> Response in
        let wantsUpgrade = request.headers.first(name: .upgrade)?
            .lowercased().contains("websocket") ?? false

        guard wantsUpgrade else {
            return try await VTeleCenter.shared.snapshot().encodeResponse(for: request)
        }

        let response = Response(status: .switchingProtocols)
        response.upgrader = WebSocketUpgrader(
            maxFrameSize: .default,
            shouldUpgrade: { request.eventLoop.makeSucceededFuture([:]) },
            onUpgrade: { socket in Task { await runVteleSocket(socket) } }
        )
        return response
    }
}

/// Snapshot on connect, then every 5 seconds until the socket closes.
private func runVteleSocket(_ socket: WebSocket) async {
    await VTeleCenter.shared.wsOpened()
    socket.onClose.whenComplete { _ in
        Task { await VTeleCenter.shared.wsClosed() }
    }
    socket.onText { _, _ in
        Task { await VTeleCenter.shared.countWsMessage() }
    }
    socket.onBinary { _, _ in
        Task { await VTeleCenter.shared.countWsMessage() }
    }
    let encoder = JSONEncoder()
    while !socket.isClosed {
        if let data = try? encoder.encode(await VTeleCenter.shared.snapshot()) {
            try? await socket.send(String(decoding: data, as: UTF8.self))
        }
        try? await Task.sleep(nanoseconds: 5_000_000_000)
    }
}
