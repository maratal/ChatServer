# Telemetry

`GET /telemetry` — public, like `/api/info`. One JSON snapshot per request,
`Cache-Control: no-store`.

The server measures, the client divides. A single cycle (5s by default) reads the
counters, works out what happened since the previous pass, and pushes the result
onto a short cache — about ten seconds of it. A dashboard polls that cache every
five seconds and replays it one step per second, so a five-second round trip
still reads as a live per-second feed. The cache runs longer than the poll gap
on purpose: consecutive responses overlap, so a dropped poll is made good by the
next one rather than leaving a hole in the replay. Samples are identified by
`ts`, so a client can discard what it has already seen.

## Response

```jsonc
{
  "cycle": 5,                          // seconds per measurement
  "cache": 10,                         // seconds of history `samples` covers
  "samples": [                         // oldest first, one entry per cycle
    {
      "ts": 1757000000,                // unix seconds, when it was taken
      "seconds": 5,                    // the span it covers — the divisor
      "totalRequestsCount": 43,        // requests in that span, monitor polling included
      "clientRequestsCount": 12,       // the same, monitor polling excluded
      "messagesCount": 3               // messages users posted in that span
    }
  ],
  "wsConnectionsCount": 2,             // websocket connections open now (a level)

  "totalRequestsCount": 91234,         // lifetime, monitor polling included
  "userRequestsCount": 40122,          // lifetime, monitor polling excluded
  "todayRequestsCount": 512,           // user requests so far today
  "totalMessagesCount": 5120,          // lifetime messages users posted
  "todayMessagesCount": 64,            // messages posted so far today
  "todayUsersCount": 18,               // installs seen in the last 24 hours
  "totalUsersCount": 431,              // installs ever seen

  "maxRequestsPerSecond": 42.0,        // all-time high of user requests/s
  "maxRequestsPerSecondAt": 1757000000,// unix seconds, when that high was set
  "dailyPeakRequestsPerSecond": 12.5,  // today's high of user requests/s
  "dailyPeakRequestsPerSecondAt": 1757000000, // unix seconds, when it was set
  "maxMessagesPerSecond": 8.0,
  "maxMessagesPerSecondAt": 1756900000,
  "dailyPeakMessagesPerSecond": 3.0,
  "dailyPeakMessagesPerSecondAt": 1757000000
}
```

Samples carry counts and their span rather than a rate. A rate is one number the
client cannot take apart, and the dashboard needs the split: the grid and the big
digit include monitor polling, so a quiet site does not read as a dead one, while
every figure labelled a total or a peak describes real users. Sending `seconds`
rather than assuming `cycle` also means a server tuned to a different cycle stays
readable by the same client.

## Monitors

A dashboard watching this app is not a user of it, and left open it would
otherwise show up as steady traffic on an app nobody is touching — the very
thing the figures exist to make visible.

So a monitor marks its polling requests:

```
X-Monitor: 1
```

A marked request is counted in `totalRequestsCount` and kept out of
`userRequestsCount`; peaks, which are user rates, ignore it entirely. `GET
/telemetry` counts as polling whether or not it is marked — nobody opens it as a
page.

Mark the repeating polls, not the buttons: a status tick is the monitor working,
whereas a refresh or an update is a person acting and counts as one. `/api/info`
is why the header exists rather than a list of paths — a status poll and a user
opening the app arrive on the same route, and no amount of path matching can
tell them apart.

Rates are fractional throughout. Under 1/s is the ordinary case for a small
deployment, and rounding would erase it.

`TELEMETRY_CYCLE_SECONDS` and `TELEMETRY_CACHE_SECONDS` tune the two periods. The
cache is never shorter than one cycle.

## Users

An app has no login on every page, so a user is a browser: the first request
that arrives without an `install_id` cookie is issued one, and every request
after carries it back.

```
Set-Cookie: install_id=<uuid>; Expires=<+10y>; Path=/; HttpOnly; SameSite=Lax
```

Monitor polling gets no cookie and is not counted — a dashboard left open would
otherwise read as one browser using the app around the clock.

Requests are counted in memory, one entry per cookie, and written to `installs`
(`install_id`, `request_count`, `created_at`, `updated_at`) on the persistence
cycle rather than once a request. Entries hold what has not been written yet and
are added to the stored row, so a restart adds to the lifetime count instead of
overwriting it.

The write is one `INSERT … ON CONFLICT (install_id) DO UPDATE` per pass — 500
installs per statement — rather than a query per install: the addition is done by
the database (`installs.request_count + EXCLUDED.request_count`), and `RETURNING
(xmax = 0)` says which rows were new.

`totalUsersCount` is counted once at launch and incremented when the flush
inserts a row: a `COUNT(*)` per pass would cost more the longer the app has been
running, which is backwards for something the cycle does forever.

`todayUsersCount` is the entries seen in the last 24 hours — a rolling window,
not a calendar day, so a figure read at 00:05 is not an almost empty one. At
launch the rows inside that window are read back, so a restart does not report a
day with nobody in it.

## Persistence

Peaks and lifetime counts survive restarts in `stat_records` — one row per
parameter (`telemetry_param`, `value`, `created_at`, `updated_at`), listed in
`TelemetryParam`. Adding a figure is a new case there and nothing else.

`todayRequestsCount` and `todayMessagesCount` are dated the same way the daily
peaks are: a row last written on an earlier day is not today's, so it reads as
zero and the day's first write replaces it. No scheduled reset, and a restart
mid-day keeps the day's figure.

Counts are rewritten whenever they move; peaks only when a record is set. A daily
peak is dated by its row's `updated_at`: a high last written on an earlier day is
not today's, so it reads as zero and the day's first record overwrites it — no
separate day column, and no scheduled reset.

Measuring and writing share one loop but not one period. Every cycle measures —
that is what the dashboard reads, and it never touches the database. Every
`TELEMETRY_PERSIST_SECONDS` (30 by default, never shorter than a cycle) the same
pass writes the params and flushes the install map, so the two never interleave
their queries. The window is what a crash costs: at most that many seconds of
counts, and a record high set inside it. It is longer than the cycle because the
install writes scale with how many people are using the app, while a cycle's
worth of one browser's hits coalesces into a single update.

Peaks measure **user** requests. Telemetry polling is a steady background drip,
and letting it set the floor would turn every peak into a measure of how often a
dashboard was open.
