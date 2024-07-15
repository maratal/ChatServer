import Vapor
import Logging

extension Application {
    static var shared: Application!
}

@main
enum Entrypoint {
    static func main() async throws {
        var env = try Environment.detect()
        try LoggingSystem.bootstrap(from: &env)
        
        let app = Application(env)        
        defer { app.shutdown() }
        
        do {
            try configure(app)
        }
        catch {
            app.logger.report(error: error)
            throw error
        }
        Service.shared = .live
        try await app.execute()
    }
}
