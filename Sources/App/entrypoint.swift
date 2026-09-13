import Vapor
import Logging

@main
enum Entrypoint {
    static func main() throws {
        let env = try Environment.detect()
//        try LoggingSystem.bootstrap(from: &env)
        LoggingSystem.bootstrap { label in
            MultiplexLogHandler(
                [
                    FileLogHandler(label: label, logLevel: .notice, localPath: "Logs/Service.log"), // do not log info/debug level to the file
                    StreamLogHandler.standardOutput(label: label)
                ]
            )
        }
        
        let app = Application(env)
        defer { app.shutdown() }
        
        var service: CoreService = .live(app)
        
        do {
            try configure(app, service: &service)
            try app.autoMigrate().wait()

            // After migrating, so the tables exist: load every in-memory store
            // from what the last run left behind, then start the two cycles —
            // one measures, one writes. main() is synchronous, hence the bridge.
            try app.eventLoopGroup.next().makeFutureWithTask {
                try await InMemoryDataManager.restore(on: app.db)
            }.wait()
            TelemetryRecorder.start()
            InMemoryDataManager.start(on: app)
        }
        catch {
            app.logger.report(error: error)
            throw error
        }
        try app.run()
    }
}
