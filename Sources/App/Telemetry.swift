import Vapor

/// Visual telemetry — live request/connection/message figures exposed at:
///
///     GET https://<app>/telemetry
///
/// The server measures; the dashboard divides. One cycle (5s by default) reads
/// the counters, works out what happened since the previous pass, and pushes the
/// result onto a short cache — roughly ten seconds of it. The dashboard polls
/// that cache every five seconds and replays it one column per second, so a
/// five-second round trip still reads as a live per-second feed. The cache runs
/// longer than the poll gap on purpose: responses overlap, so a dropped one is
/// made good by the next.
///
/// Snapshot shape:
///   cycle                       seconds per measurement
///   cache                       seconds of history `samples` covers
///   samples                     oldest first, one entry per cycle:
///     ts                        unix seconds when the measurement was taken
///     seconds                   seconds it covers — divide the counts by this
///     totalRequestsCount        requests in that span, monitor polling included
///     clientRequestsCount       the same with monitor polling excluded
///     messagesCount             messages users posted in that span
///   wsConnectionsCount          websocket connections open right now (a level)
///   totalRequestsCount          lifetime requests, monitor polling included
///   userRequestsCount           lifetime requests, monitor polling excluded
///   totalMessagesCount          lifetime messages users posted
///   maxRequestsPerSecond        all-time high of user requests/s
///   dailyPeakRequestsPerSecond  today's high of user requests/s
///   maxMessagesPerSecond        all-time high of messages/s
///   dailyPeakMessagesPerSecond  today's high of messages/s
///
/// Counts are sent raw rather than as rates: a rate is one number the client
/// cannot take apart, and the dashboard needs the split — the grid and the big
/// digit include that polling so a quiet server does not look dead, while every
/// figure labelled a total or a peak describes real users. Peaks and
/// counts are persisted to `stat_records`, one row per param — see
/// `TelemetryParam` and `StatStore`.
struct TelemetrySnapshot: Content {
    let cycle: Int
    let cache: Int
    let samples: [TelemetrySample]
    let wsConnectionsCount: Int
    let totalRequestsCount: Int
    let userRequestsCount: Int
    let totalMessagesCount: Int
    let maxRequestsPerSecond: Double
    let dailyPeakRequestsPerSecond: Double
    let maxMessagesPerSecond: Double
    let dailyPeakMessagesPerSecond: Double
}

/// One cycle's worth of measurement. Counts, not rates — `seconds` is the
/// divisor, and it is sent rather than assumed because a server configured with
/// a different cycle must still be readable by the same dashboard.
struct TelemetrySample: Content {
    let ts: Double
    let seconds: Double
    let totalRequestsCount: Int
    let clientRequestsCount: Int
    let messagesCount: Int
}

/// The cycle, and how much of it is kept.
///
/// Both are environment-tunable because they trade different things: a shorter
/// cycle buys resolution at the cost of database writes, and a longer cache
/// lets the dashboard poll less often at the cost of showing older news on a
/// fresh page load. The defaults — measure every 5s, keep 10s — give the
/// dashboard two samples per poll.
enum TelemetryConfig {
    /// Seconds between measurements. `TELEMETRY_CYCLE_SECONDS` overrides.
    static let cycleSeconds: Int =
        max(1, Environment.get("TELEMETRY_CYCLE_SECONDS").flatMap(Int.init(_:)) ?? 5)

    /// Seconds of measurement the cache holds. `TELEMETRY_CACHE_SECONDS`
    /// overrides. Never shorter than one cycle — a cache that cannot hold a
    /// single measurement would hand the dashboard an empty array.
    static let cacheSeconds: Int =
        max(TelemetryConfig.cycleSeconds, Environment.get("TELEMETRY_CACHE_SECONDS").flatMap(Int.init(_:)) ?? 10)

    /// How many samples that works out to: two at 5s/10s, ten at 1s/10s.
    static var cacheCapacity: Int {
        max(1, Int((Double(cacheSeconds) / Double(cycleSeconds)).rounded(.up)))
    }
}

/// All mutable telemetry state lives in this actor — reads and writes are
/// serialized by the actor executor, which is the thread synchronization for
/// concurrent request and websocket handlers.
actor TelemetryCenter {
    static let shared = TelemetryCenter()

    // MARK: - Lifetime counters

    /// Every REST request the app serves, a dashboard's polling included:
    /// polling is real load and is reported as such.
    private var totalRequests = 0
    /// The same, minus that polling — what actual users asked for.
    private var userRequests = 0
    /// Chat messages users typed and sent, one per posted message.
    private var totalMessages = 0
    /// Websocket connections open right now, not a running total: it rises and
    /// falls as clients come and go.
    private var wsConnections = 0

    // MARK: - Cycle state

    /// The counter values at the previous cycle and when it ran: the pair every
    /// measurement is derived from.
    private var lastTotalRequests = 0
    private var lastUserRequests = 0
    private var lastTotalMessages = 0
    private var lastTickAt: Date?

    /// The rolling cache the dashboard reads, oldest first.
    private var samples: [TelemetrySample] = []

    // MARK: - Peaks

    /// Peaks describe user traffic, not total: a dashboard's polling is a steady
    /// background drip, and letting it set the floor would make every peak a
    /// measure of how often that dashboard is open.
    private var maxRequestsPerSecond = 0.0
    private var dailyPeakRequestsPerSecond = 0.0
    private var maxMessagesPerSecond = 0.0
    private var dailyPeakMessagesPerSecond = 0.0

    /// The UTC day the daily peaks describe. When the cycle finds it stale the
    /// daily highs start over, so one spike cannot pin them forever.
    private var dailyPeakDay: Date?

    // MARK: - Counting

    /// - Parameter monitoring: whether a dashboard made this request to watch
    ///   the app rather than to use it. Counted in the total either way —
    ///   polling is real load — and excluded from the user figure.
    func countRequest(monitoring: Bool) {
        totalRequests += 1
        if !monitoring {
            userRequests += 1
        }
    }

    /// One chat message posted by a user.
    func countMessage() {
        totalMessages += 1
    }

    func wsOpened() {
        wsConnections += 1
    }

    func wsClosed() {
        wsConnections = max(0, wsConnections - 1)
    }

    // MARK: - The cycle

    /// Take one measurement and report every param worth writing.
    ///
    /// The returned dictionary always carries the lifetime counts — they move
    /// with every request — and carries a peak only when this cycle set a new
    /// record. `StatStore` decides what actually reaches the database.
    ///
    /// The first pass after launch only establishes a baseline: there is no
    /// earlier reading to measure against, and dividing lifetime totals by the
    /// uptime would report a long-run average dressed up as a live rate.
    @discardableResult
    func tick(at now: Date = Date()) -> [TelemetryParam: Double] {
        defer {
            lastTotalRequests = totalRequests
            lastUserRequests = userRequests
            lastTotalMessages = totalMessages
            lastTickAt = now
        }
        rollDailyWindow(at: now)

        guard let previous = lastTickAt else { return counts() }

        let elapsed = max(1.0, now.timeIntervalSince(previous))
        let requestDelta = max(0, totalRequests - lastTotalRequests)
        let userDelta = max(0, userRequests - lastUserRequests)
        let messageDelta = max(0, totalMessages - lastTotalMessages)

        append(TelemetrySample(
            ts: now.timeIntervalSince1970.rounded(.down),
            seconds: elapsed.rounded(),
            totalRequestsCount: requestDelta,
            clientRequestsCount: userDelta,
            messagesCount: messageDelta
        ))

        // Fractional on purpose: at a 5s cycle, integer division would floor
        // anything under 1/s to zero, so a quiet app that is plainly serving
        // requests would report a flat line of nothing.
        let requestRate = Double(userDelta) / elapsed
        let messageRate = Double(messageDelta) / elapsed

        var changed = counts()
        if requestRate > maxRequestsPerSecond {
            maxRequestsPerSecond = requestRate
            changed[.maxRequestsPerSecond] = requestRate
        }
        if requestRate > dailyPeakRequestsPerSecond {
            dailyPeakRequestsPerSecond = requestRate
            changed[.dailyPeakRequestsPerSecond] = requestRate
        }
        if messageRate > maxMessagesPerSecond {
            maxMessagesPerSecond = messageRate
            changed[.maxMessagesPerSecond] = messageRate
        }
        if messageRate > dailyPeakMessagesPerSecond {
            dailyPeakMessagesPerSecond = messageRate
            changed[.dailyPeakMessagesPerSecond] = messageRate
        }
        return changed
    }

    private func counts() -> [TelemetryParam: Double] {
        [
            .totalRequestsCount: Double(totalRequests),
            .userRequestsCount: Double(userRequests),
            .totalMessagesCount: Double(totalMessages),
        ]
    }

    /// A new day starts with no highs behind it. The stored rows are left as
    /// they are — a row last written yesterday already reads as stale, and the
    /// first record of the new day overwrites it.
    private func rollDailyWindow(at now: Date) {
        let today = Calendar.utc.startOfDay(for: now)
        guard dailyPeakDay != today else { return }
        dailyPeakDay = today
        dailyPeakRequestsPerSecond = 0
        dailyPeakMessagesPerSecond = 0
    }

    private func append(_ sample: TelemetrySample) {
        samples.append(sample)
        let capacity = TelemetryConfig.cacheCapacity
        if samples.count > capacity {
            samples.removeFirst(samples.count - capacity)
        }
    }

    // MARK: - Persistence hand-off

    /// Seed from the stored params at launch. Counts are lifetime figures, so a
    /// restart that started them at zero would make the dashboard's total fall
    /// backwards; peaks arrive already filtered for staleness by `StatStore`.
    func restore(_ values: [TelemetryParam: Double], at now: Date = Date()) {
        totalRequests = Int(values[.totalRequestsCount] ?? 0)
        userRequests = Int(values[.userRequestsCount] ?? 0)
        totalMessages = Int(values[.totalMessagesCount] ?? 0)
        lastTotalRequests = totalRequests
        lastUserRequests = userRequests
        lastTotalMessages = totalMessages

        maxRequestsPerSecond = values[.maxRequestsPerSecond] ?? 0
        dailyPeakRequestsPerSecond = values[.dailyPeakRequestsPerSecond] ?? 0
        maxMessagesPerSecond = values[.maxMessagesPerSecond] ?? 0
        dailyPeakMessagesPerSecond = values[.dailyPeakMessagesPerSecond] ?? 0
        dailyPeakDay = Calendar.utc.startOfDay(for: now)
    }

    func snapshot() -> TelemetrySnapshot {
        TelemetrySnapshot(
            cycle: TelemetryConfig.cycleSeconds,
            cache: TelemetryConfig.cacheSeconds,
            samples: samples,
            wsConnectionsCount: wsConnections,
            totalRequestsCount: totalRequests,
            userRequestsCount: userRequests,
            totalMessagesCount: totalMessages,
            maxRequestsPerSecond: maxRequestsPerSecond,
            dailyPeakRequestsPerSecond: dailyPeakRequestsPerSecond,
            maxMessagesPerSecond: maxMessagesPerSecond,
            dailyPeakMessagesPerSecond: dailyPeakMessagesPerSecond
        )
    }
}

/// Counts every REST request, and separates a monitor's polling from real use.
struct TelemetryMiddleware: AsyncMiddleware {
    /// The telemetry endpoint, matched here rather than by route because
    /// middleware runs before routing has picked one. Never a page a person
    /// opens, so it counts as polling whether or not it is marked.
    static let path = "/telemetry"

    /// How a dashboard declares its own polling. `/api/info` is the reason this
    /// exists: a status poll and a user opening the app hit the same route, so
    /// the path cannot tell them apart, and a list of paths would rot the next
    /// time one is renamed. The proxy in front of the app passes it on.
    static let monitorHeader = "X-Monitor"

    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        let monitoring = request.url.path == Self.path
            || request.headers.first(name: Self.monitorHeader) != nil
        Task { await TelemetryCenter.shared.countRequest(monitoring: monitoring) }
        return try await next.respond(to: request)
    }
}

/// The `/telemetry` endpoint: one JSON snapshot per request. Public, like
/// `/api/info`. The dashboard polls it every 5s and replays the cache.
func telemetryRoutes(_ app: Application) {
    app.get("telemetry") { request async throws -> Response in
        let response = try await TelemetryCenter.shared.snapshot().encodeResponse(for: request)
        // The whole point is freshness; a cached snapshot is a lie by the time
        // it is read.
        response.headers.cacheControl = HTTPHeaders.CacheControl(noStore: true)
        return response
    }
}
