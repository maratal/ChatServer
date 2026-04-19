# ChatServer — Agent Instructions

Swift Vapor 4.x chat server with PostgreSQL, WebSockets, and a vanilla-JS web frontend.

## Build & Test

```sh
swift build                        # compile
swift test                         # run all tests (requires a running PostgreSQL)
swift test --filter ChatTests      # run a single test class
```

Tests use a live PostgreSQL connection — ensure the DB is reachable with the env vars below before running.

## Environment Variables

| Variable | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | Preferred (Heroku). Overrides all below |
| `DATABASE_HOST` | `localhost` | |
| `DATABASE_PORT` | `5432` | |
| `DATABASE_USERNAME` | `postgres` | |
| `DATABASE_PASSWORD` | — | |
| `DATABASE_NAME` | `postgres` | |
| `TLS_CERT_PATH` / `TLS_KEY_PATH` | — | Optional TLS |

## Architecture

See [Architecture notes](memories/repo/ChatServer-architecture.md) for a full breakdown.  
API reference: [Users](Docs/APIREF-Users.md) · [Chats](Docs/APIREF-Chats.md) · [Contacts](Docs/APIREF-Contacts.md) · [Files](Docs/APIREF-Files.md) · [WebSocket](Docs/APIREF-WebSocket.md) · [JSON schemas](Docs/APIREF-JSON.md)

**Layer responsibilities** (never mix):
- **Controllers** (`Sources/App/Controllers/`): extract request params → call service → encode response. No DB access.
- **Services** (`Sources/App/Services/`): Swift actors, business logic only. No Vapor/Request imports.
- **Repositories** (`Sources/App/Repositories/`): all database queries; always eager-load relations needed by callers.
- **Models** (`Sources/App/Models/`): Fluent models + `Serializables.swift` for request/response structs.

**Key files**:
- `Sources/App/CoreService.swift` — central actor, lazily initialises all sub-services; owns WebSocketManager + NotificationManager
- `Sources/App/Misc/Aliases.swift` — `ServiceError = Abort`, `UserID = Int`, `ChatID = UUID`, etc.
- `Sources/App/Misc/Utils.swift` — custom `JSONEncoder`/`JSONDecoder` that use **UNIX timestamps** (not ISO-8601)
- `Sources/App/Misc/JSON.swift` — `JSON` type alias (`[String: Sendable]`), `JSONSerializable` protocol

## Conventions

- **UNIX timestamps everywhere** — the custom encoder/decoder in `Utils.swift` is wired globally; never use ISO-8601 dates in API responses.
- **`ServiceError`** is just `Abort`; throw it from services with appropriate HTTP status codes.
- **SVG icons** — all reusable icons live in `Public/app/js/svg-icons.js`; add new icons there, not inline.
- **Frontend auth** — `currentUser` JSON (with `session.accessToken`) is persisted in `localStorage`; `api.js` reads it for every request. WebSocket auth uses `?token=` URL param.
- **Chat `participantsKey`** — sorted + hashed user IDs; used for dedup lookup of personal chats.
- **Soft deletes** — messages use `deletedAt`; hard deletes are not used for messages.
- **File uploads** — files are uploaded independently first, then referenced by `MediaInfo` in the message payload. Previews are generated server-side.
- **`ReadOnlyFileMiddleware`** — static files are served only for GET/HEAD; do not bypass this.

## Testing Conventions

Base class: `AppTestCase` (in `Tests/AppTests/Misc/TestUtils.swift`).

```swift
// Typical test structure
func test_01_getSomething() async throws {
    let current = try await service.seedCurrentUser()   // creates user with Bearer token in app
    let user = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")[0]
    // seed data, then:
    try await asyncTest(.GET, "api/chats", headers: .none, afterResponse: { res in
        XCTAssertEqual(res.status, .ok, res.body.string)
        let result = try res.content.decode([ChatInfo].self)
        // assertions
    })
}
```

- Test methods are numbered sequentially: `test_01_`, `test_02_`, …
- `service.seedCurrentUser()` creates user #1 and sets the request auth header automatically.
- Use `asyncTest(_:_:headers:beforeRequest:afterResponse:)` — **not** `app.test(...)` — to avoid Swift concurrency warnings.
- `AppLiveTestCase` runs against a real live server; use for WebSocket/push tests.
- Clean up uploaded files after tests: `service.removeFiles(for: resource)`.
