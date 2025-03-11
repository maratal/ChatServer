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
        }
        catch {
            app.logger.report(error: error)
            throw error
        }
        try app.run()
    }
}
