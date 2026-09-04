# Telemetry

`GET /telemetry` — public, like `/api/info`. One JSON snapshot per request,
`Cache-Control: no-store`.

The server measures, the client divides. A single cycle (5s by default) reads the
counters, works out what happened since the previous pass, and pushes the result
onto a short cache — about ten seconds of it. A dashboard polls that cache every
ten seconds and replays it one step per second, so a ten-second round trip still
reads as a live per-second feed.

## Response

```jsonc
{
  "cycle": 5,                          // seconds per measurement
  "cache": 10,                         // seconds of history `samples` covers
  "samples": [                         // oldest first, one entry per cycle
    {
      "ts": 1757000000,                // unix seconds, when it was taken
      "seconds": 5,                    // the span it covers — the divisor
      "totalRequestsCount": 43,        // requests in that span, /telemetry included
      "clientRequestsCount": 12,       // the same, /telemetry polling excluded
      "messagesCount": 3               // messages users posted in that span
    }
  ],
  "wsConnectionsCount": 2,             // websocket connections open now (a level)

  "totalRequestsCount": 91234,         // lifetime, /telemetry included
  "userRequestsCount": 40122,          // lifetime, /telemetry excluded
  "totalMessagesCount": 5120,          // lifetime messages users posted

  "maxRequestsPerSecond": 42.0,        // all-time high of user requests/s
  "dailyPeakRequestsPerSecond": 12.5,  // today's high of user requests/s
  "maxMessagesPerSecond": 8.0,
  "dailyPeakMessagesPerSecond": 3.0
}
```

Samples carry counts and their span rather than a rate. A rate is one number the
client cannot take apart, and the dashboard needs the split: the grid and the big
digit include telemetry polling, so a quiet site does not read as a dead one,
while every figure labelled a total or a peak describes real users. Sending
`seconds` rather than assuming `cycle` also means a server tuned to a different
cycle stays readable by the same client.

Rates are fractional throughout. Under 1/s is the ordinary case for a small
deployment, and rounding would erase it.

`TELEMETRY_CYCLE_SECONDS` and `TELEMETRY_CACHE_SECONDS` tune the two periods. The
cache is never shorter than one cycle.

## Persistence

Peaks and lifetime counts survive restarts in `stat_records` — one row per
parameter (`telemetry_param`, `value`, `created_at`, `updated_at`), listed in
`TelemetryParam`. Adding a figure is a new case there and nothing else.

Counts are rewritten whenever they move. Peaks are only written when a record is
set, so the same cycle that measures also persists without costing a write per
pass. A daily peak is dated by its row's `updated_at`: a high last written on an
earlier day is not today's, so it reads as zero and the day's first record
overwrites it — no separate day column, and no scheduled reset.

Peaks measure **user** requests. Telemetry polling is a steady background drip,
and letting it set the floor would turn every peak into a measure of how often a
dashboard was open.
