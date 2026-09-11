/**
 * Dashboard controller — server management.
 *
 * The same operations answer on two prefixes, because two kinds of caller reach
 * them. `/dashboard/api` is this server's own web dashboard. `/api` is the
 * shape a control panel expects of any app it manages, so this server is
 * updatable from one without the panel needing to know it is this server.
 *
 * One set of handlers, one authorization check. See `requireManagement`.
 */
import Vapor

struct DashboardController: RouteCollection {

    func boot(routes: RoutesBuilder) throws {
        let dashboard = routes.grouped("dashboard", "api").grouped(DeviceSession.authenticator())
        dashboard.get("info", use: info)
        dashboard.post("refresh", use: refresh)
        dashboard.post("update", use: update)
        dashboard.get("log", use: getLog)

        // The same handlers under the panel's names. The authenticator is here
        // too, so a request carrying a device session is recognised on either
        // prefix. Not `info` — `/api/info` is already the public product info.
        let managed = routes.grouped("api").grouped(DeviceSession.authenticator())
        managed.post("refresh", use: refresh)
        managed.post("update", use: update)
        managed.get("update-log", use: getLog)
    }

    func info(_ req: Request) async throws -> Response {
        try requireManagement(req)
        let output = try await runScript("sysinfo.sh", on: req)
        return Response(status: .ok, headers: ["Content-Type": "application/json"], body: .init(string: output))
    }

    func refresh(_ req: Request) async throws -> Response {
        try requireManagement(req)
        let output = try await runScript("refresh.sh", on: req, asSudo: true)
        return Response(status: .ok, headers: ["Content-Type": "application/json"],
                        body: .init(string: #"{"status":"ok","output":"\#(output.escaped)"}"#))
    }

    /// Detached through `systemd-run`: update.sh restarts this service, so a
    /// child of this process would be killed partway through its own update.
    func update(_ req: Request) async throws -> Response {
        try requireManagement(req)
        let directory = req.application.directory.workingDirectory
        let path = directory + "update.sh"
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/sudo")
        process.arguments = ["-n", "systemd-run", "--collect", path]
        process.currentDirectoryURL = URL(fileURLWithPath: directory)
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        return Response(status: .ok, headers: ["Content-Type": "application/json"],
                        body: .init(string: #"{"status":"ok"}"#))
    }

    func getLog(_ req: Request) async throws -> Response {
        try requireManagement(req)
        let logPath = "/tmp/chatserver-update.log"
        let content: String
        if let data = FileManager.default.contents(atPath: logPath) {
            content = String(data: data, encoding: .utf8) ?? ""
        } else {
            content = ""
        }
        return Response(status: .ok, headers: ["Content-Type": "application/json"],
                        body: .init(string: #"{"log":"\#(content.escaped)"}"#))
    }

    /// Either proof of authority, in order: a signed-in admin, or the management
    /// token.
    ///
    /// The session is tried first because it is the stricter claim — it names a
    /// user. Only when there is no session at all does the token get a look,
    /// which is the case for a control panel: it has no account here, just the
    /// secret written to `MGMT_TOKEN` at install. A caller presents one or the
    /// other, never both, so the fallback never masks a real rejection: a
    /// session that exists but is not the admin fails outright.
    ///
    /// Missing configuration is a 503 rather than a 403, because "this server
    /// was never set up to be managed" and "you presented the wrong secret" send
    /// an operator to different places.
    private func requireManagement(_ req: Request) throws {
        if let user = req.auth.get(User.self) {
            guard user.id == 1 else {
                throw Abort(.forbidden)
            }
            return
        }
        guard let expected = Environment.get("MGMT_TOKEN"), !expected.isEmpty else {
            throw Abort(.serviceUnavailable, reason: "Remote management is not configured on this droplet.")
        }
        guard constantTimeEquals(req.headers.bearerAuthorization?.token ?? "", expected) else {
            throw Abort(.forbidden, reason: "Invalid management token.")
        }
    }

    /// Compared in constant time: a byte-by-byte compare that returns early
    /// leaks the length of the matching prefix to anyone willing to time it.
    private func constantTimeEquals(_ a: String, _ b: String) -> Bool {
        let lhs = Array(a.utf8), rhs = Array(b.utf8)
        guard lhs.count == rhs.count else { return false }
        var difference: UInt8 = 0
        for index in lhs.indices {
            difference |= lhs[index] ^ rhs[index]
        }
        return difference == 0
    }

    private func runScript(_ name: String, on req: Request, asSudo: Bool = false) async throws -> String {
        let directory = req.application.directory.workingDirectory
        let path = directory + name
        let process = Process()
        if asSudo {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/sudo")
            process.arguments = ["-n", path]
        } else {
            process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            process.arguments = ["bash", path]
        }
        process.currentDirectoryURL = URL(fileURLWithPath: directory)
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        try process.run()
        process.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        guard process.terminationStatus == 0 else {
            let message = String(data: data, encoding: .utf8) ?? "Script failed"
            throw Abort(.internalServerError, reason: message)
        }
        return String(data: data, encoding: .utf8) ?? ""
    }
}

private extension String {
    var escaped: String {
        self.replacingOccurrences(of: "\u{1B}\\[[0-9;]*m", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "\"", with: "\\\"")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
            .replacingOccurrences(of: "\t", with: "\\t")
    }
}
