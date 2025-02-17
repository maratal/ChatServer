import Vapor
import Logging

@main
enum Entrypoint {
    static func main() throws {
        var env = try Environment.detect()
        try LoggingSystem.bootstrap(from: &env)
        
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
