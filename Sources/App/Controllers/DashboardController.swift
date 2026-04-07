/**
 * Dashboard controller — admin-only endpoints for server management.
 */
import Vapor

struct DashboardController: RouteCollection {

    func boot(routes: RoutesBuilder) throws {
        let dashboard = routes.grouped("dashboard", "api").grouped(DeviceSession.authenticator())
        dashboard.get("info", use: info)
        dashboard.post("refresh", use: refresh)
        dashboard.post("update", use: update)
        dashboard.get("log", use: getLog)
    }

    func info(_ req: Request) async throws -> Response {
        try requireAdmin(req)
        let output = try await runScript("sysinfo.sh", on: req)
        return Response(status: .ok, headers: ["Content-Type": "application/json"], body: .init(string: output))
    }

    func refresh(_ req: Request) async throws -> Response {
        try requireAdmin(req)
        let output = try await runScript("refresh.sh", on: req, asSudo: true)
        return Response(status: .ok, headers: ["Content-Type": "application/json"],
                        body: .init(string: #"{"status":"ok","output":"\#(output.escaped)"}"#))
    }

    func update(_ req: Request) async throws -> Response {
        try requireAdmin(req)
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
        try requireAdmin(req)
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

    private func requireAdmin(_ req: Request) throws {
        guard try req.authenticatedUser().id == 1 else {
            throw Abort(.forbidden)
        }
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
