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

  "maxRequestsPerSecond": 42.0,        // all-time high of user requests/s
  "maxRequestsPerSecondAt": 1757000000,// unix seconds, when that high was set
  "dailyPeakRequestsPerSecond": 12.5,  // today's high of user requests/s
  "maxMessagesPerSecond": 8.0,
  "maxMessagesPerSecondAt": 1756900000,
  "dailyPeakMessagesPerSecond": 3.0
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

## Persistence

Peaks and lifetime counts survive restarts in `stat_records` — one row per
parameter (`telemetry_param`, `value`, `created_at`, `updated_at`), listed in
`TelemetryParam`. Adding a figure is a new case there and nothing else.

`todayRequestsCount` is dated the same way the daily peak is: a row last written
on an earlier day is not today's, so it reads as zero and the day's first write
replaces it. No scheduled reset, and a restart mid-day keeps the day's figure.

Counts are rewritten whenever they move. Peaks are only written when a record is
set, so the same cycle that measures also persists without costing a write per
pass. A daily peak is dated by its row's `updated_at`: a high last written on an
earlier day is not today's, so it reads as zero and the day's first record
overwrites it — no separate day column, and no scheduled reset.

Peaks measure **user** requests. Telemetry polling is a steady background drip,
and letting it set the floor would turn every peak into a measure of how often a
dashboard was open.
