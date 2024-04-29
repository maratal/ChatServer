@testable import App
import XCTVapor

final class AuthTests: XCTestCase {
    
    var app: Application!
    
    override func setUp() {
        app = try! Application.testable()
    }
    
    override func tearDown() {
        app.shutdown()
    }
    
    func testCreateUser() throws {
        try app.test(.POST, "users/", beforeRequest: { req in
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
    
    func testLoginUser() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "login/",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let login = try res.content.decode(AuthController.LoginResponse.self)
            XCTAssertNotNil(login.token)
            tokenString = login.token
        })
        
        try app.test(.GET, "users/me",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(UserInfo.self)
            XCTAssertEqual(info.username, CurrentUser.username)
        })
        
        try app.test(.GET, "users/me",
                     headers: .authWith(token: "fake"),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testLoginUserFailure() async throws {
        try await seedCurrentUser()
        try app.test(.POST, "login/",
                     headers: .authWith(username: CurrentUser.username, password: "123"),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
}
