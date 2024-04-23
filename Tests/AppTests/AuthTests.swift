@testable import App
import XCTVapor

// These tests should run together.

final class AuthTests: XCTestCase {
    
    static var app: Application!
    
    override class func setUp() {
        app = try! Application.testable()
    }
    
    override class func tearDown() {
        app.shutdown()
    }
    
    func testCreateUser() throws {
        try Self.app.test(.POST, "users/", beforeRequest: { req in
            try req.content.encode([
                "name": "Test",
                "username": "testuser",
                "password": "********"
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let login = try res.content.decode(AuthController.LoginResponse.self)
            XCTAssertEqual(login.info.username, "testuser")
            XCTAssertNotNil(login.token)
        })
    }
    
    func testLoginUser() throws {
        var tokenString = ""
        try Self.app.test(.POST, "login/",
                          headers: .authWith(username: "testuser", password: "********"),
                          afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let login = try res.content.decode(AuthController.LoginResponse.self)
            XCTAssertNotNil(login.token)
            tokenString = login.token
        })
        
        try Self.app.test(.GET, "users/me",
                          headers: .authWith(token: tokenString),
                          afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(UserInfo.self)
            XCTAssertEqual(info.username, "testuser")
        })
    }
    
    func testLoginUserFailure() throws {
        try Self.app.test(.POST, "login/",
                          headers: .authWith(username: "testuser", password: "***"),
                          afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
}
