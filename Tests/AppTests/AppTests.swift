@testable import App
import XCTVapor

final class AppTests: XCTestCase {
    
    func testRootPath() async throws {
        let app = Application(.testing)
        defer { app.shutdown() }
        try await configure(app)

        try app.test(.GET, "", afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            XCTAssertEqual(res.body.string, "Demo Server v1.0")
        })
    }
    
    func testCreateUser() async throws {
        let app = Application(.testing)
        defer { app.shutdown() }
        try await configure(app)
        
        try app.test(.POST, "users", beforeRequest: { req in
            try req.content.encode([
                "name": "Demo",
                "username": "demo11",
                "password": "********"
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let login = try res.content.decode(User.LoginInfo.self)
            XCTAssertEqual(login.info.name, "Demo")
        })
    }
    
    func testLoginUser() async throws {
        let app = Application(.testing)
        defer { app.shutdown() }
        try await configure(app)
        
        var httpHeaders = HTTPHeaders()
        httpHeaders.basicAuthorization = .init(username: "demo11", password: "********")
        
        var tokenString = ""
        
        try app.test(.POST, "login", headers: httpHeaders, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let login = try res.content.decode(User.LoginInfo.self)
            XCTAssertTrue(login.token!.isValid)
            tokenString = login.token!.value
        })
        
        httpHeaders = HTTPHeaders()
        httpHeaders.bearerAuthorization = .init(token: tokenString)
        
        try app.test(.GET, "users/me", headers: httpHeaders, afterResponse: { res in
            XCTAssertEqual(res.status, .ok)
            let info = try res.content.decode(UserInfo.self)
            XCTAssertEqual(info.name, "Demo")
        })
    }
}
