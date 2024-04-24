@testable import App
import XCTVapor

extension Application {
    
    static func testable() throws -> Application {
        let app = Application(.testing)
        try configure(app)
        
        try app.autoRevert().wait()
        try app.autoMigrate().wait()
        
        return app
    }
}

extension HTTPHeaders {
    
    static var none = HTTPHeaders()
    
    static func authWith(username: String, password: String) -> Self {
        var headers = HTTPHeaders()
        headers.basicAuthorization = .init(username: username, password: password)
        return headers
    }
    
    static func authWith(token: String) -> Self {
        var headers = HTTPHeaders()
        headers.bearerAuthorization = .init(token: token)
        return headers
    }
}

func seedUsers(count: Int, namePrefix: String = "Test", usernamePrefix: String = "test") async throws {
    for i in 1...count {
        let user = User(name: "\(namePrefix) \(i)", username: "\(usernamePrefix)\(i)", passwordHash: "")
        try await Repositories.users.save(user)
    }
}
