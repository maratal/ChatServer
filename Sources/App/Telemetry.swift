import Vapor

/// Visual telemetry — live request/connection/message figures exposed at:
///
///     GET https://<app>/telemetry
///
/// Snapshot shape:
///   rps            [[unix_ts, requests in that second], ...] — newest last, 20 max
///   mps            the same for messages users posted
///   wscc           open websocket connections right now (a level, no history)
///   peakRps        highest requests/s in the current 24h window
///   peakMps        highest messages/s in the current 24h window
///   totalRequests  lifetime request count, carried across restarts
///   totalMessages  lifetime count of messages users posted
///
/// The app owns the maths: a detached task samples the counters every 5s and
/// divides by the elapsed time, so the browser renders what it is given rather
/// than differencing counters itself. Peaks and totals are persisted to the
/// `stat_records` table once a minute and reloaded at launch — see TelemetryStore.
struct TelemetrySnapshot: Content {
    let rps: [[Int]]
    let mps: [[Int]]
    let wscc: Int
    let peakRps: Int
    let peakMps: Int
    let totalRequests: Int
    let totalMessages: Int
}

/// All mutable telemetry state lives in this actor — reads and writes are
/// serialized by the actor executor, which is the thread synchronization for
/// concurrent request/websocket handlers.
actor TelemetryCenter {
    static let shared = TelemetryCenter()

    /// One point per sample and the sampler runs every 5s, so 20 points is a
    /// little over 1.5 minutes — matching the 20 columns the dashboard draws.
    private static let maxPoints = 20

    /// Every REST request the app serves, `/telemetry` included — polling it is
    /// real load and is reported as such.
    private var requestsTotal = 0
    /// Chat messages users typed and sent, one per posted message.
    private var messagesTotal = 0
    /// Websocket connections open right now, not a running total: it rises and
    /// falls as clients come and go.
    private var wsConnections = 0

    /// The counter values at the previous sample and when it was taken: the pair
    /// every per-second figure is derived from.
    private var lastRequestsTotal = 0
    private var lastMessagesTotal = 0
    private var lastSampleAt: Date?

    private var requestsPerSecond: [[Int]] = []      // [unix_ts, requests per second at unix ts]
    private var messagesPerSecond: [[Int]] = []

    private(set) var peakRequestsPerSecond = 0
    private(set) var peakMessagesPerSecond = 0

    // MARK: - Counting

    func countRequest() {
        requestsTotal += 1
    }

    /// One chat message posted by a user.
    func countMessage() {
        messagesTotal += 1
    }

    func wsOpened() {
        wsConnections += 1
    }

    func wsClosed() {
        wsConnections = max(0, wsConnections - 1)
    }

    // MARK: - Sampling

    /// Take one sample: requests and messages per second since the previous
    /// call. Driven by the detached task in `startTelemetrySampler`.
    ///
    /// The first call after launch only establishes a baseline. There is no
    /// earlier sample to measure against, and dividing a lifetime total by the
    /// uptime would report a long-run average dressed up as a current rate.
    func sample(at now: Date = Date()) {
        defer {
            lastRequestsTotal = requestsTotal
            lastMessagesTotal = messagesTotal
            lastSampleAt = now
        }
        guard let previous = lastSampleAt else { return }

        let elapsed = max(1, Int(now.timeIntervalSince(previous).rounded()))
        let ts = Int(now.timeIntervalSince1970)

        let requests = max(0, requestsTotal - lastRequestsTotal) / elapsed
        let messages = max(0, messagesTotal - lastMessagesTotal) / elapsed

        append(&requestsPerSecond, point: [ts, requests])
        append(&messagesPerSecond, point: [ts, messages])

        peakRequestsPerSecond = max(peakRequestsPerSecond, requests)
        peakMessagesPerSecond = max(peakMessagesPerSecond, messages)
    }

    private func append(_ points: inout [[Int]], point: [Int]) {
        points.append(point)
        if points.count > Self.maxPoints {
            points.removeFirst(points.count - Self.maxPoints)
        }
    }

    // MARK: - Persistence hand-off

    /// Seed from the newest stats row at launch: totals always, since they are
    /// lifetime, and peaks only while that row's 24h window is still open.
    func restore(totalRequests: Int, totalMessages: Int, peakRps: Int, peakMps: Int) {
        requestsTotal = totalRequests
        messagesTotal = totalMessages
        lastRequestsTotal = totalRequests
        lastMessagesTotal = totalMessages
        peakRequestsPerSecond = peakRps
        peakMessagesPerSecond = peakMps
    }

    /// A fresh 24h window has no history behind it, so its peaks start from the
    /// newest sample rather than inheriting the retired window's high.
    func resetPeaksForNewWindow() {
        peakRequestsPerSecond = requestsPerSecond.last?[1] ?? 0
        peakMessagesPerSecond = messagesPerSecond.last?[1] ?? 0
    }

    /// What the minute task writes to the database.
    func persistable() -> (totalRequests: Int, totalMessages: Int, peakRps: Int, peakMps: Int) {
        (requestsTotal, messagesTotal, peakRequestsPerSecond, peakMessagesPerSecond)
    }

    func snapshot() -> TelemetrySnapshot {
        TelemetrySnapshot(
            rps: requestsPerSecond,
            mps: messagesPerSecond,
            wscc: wsConnections,
            peakRps: peakRequestsPerSecond,
            peakMps: peakMessagesPerSecond,
            totalRequests: requestsTotal,
            totalMessages: messagesTotal
        )
    }
}

/// Counts every REST request.
struct TelemetryMiddleware: AsyncMiddleware {
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        Task { await TelemetryCenter.shared.countRequest() }
        return try await next.respond(to: request)
    }
}

/// The `/telemetry` endpoint: one JSON snapshot per request. Public, like
/// `/api/info`. The dashboard polls it on its status tick.
func telemetryRoutes(_ app: Application) {
    app.get("telemetry") { request async throws -> Response in
        try await TelemetryCenter.shared.snapshot().encodeResponse(for: request)
    }
}
