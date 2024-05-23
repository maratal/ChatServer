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
    
    func testRegisterUser() throws {
        try app.test(.POST, "users", beforeRequest: { req in
            try req.content.encode(
                RegistrationRequest(name: "Test", username: "testuser", password: "********", deviceInfo: .testInfo)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(response.info.username, "testuser")
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
        })
    }
    
    func testDeregisterUser() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
            tokenString = session!.accessToken
        })
        try app.test(.GET, "users/me",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.DELETE, "users/me",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.GET, "users/me",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testLoginUser() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
            tokenString = session!.accessToken
        })
        
        try app.test(.GET, "users/me",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(response.info.username, CurrentUser.username)
        })
        
        try app.test(.GET, "users/me",
                     headers: .authWith(token: "fake"),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testLoginUserFailure() async throws {
        try await seedCurrentUser()
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: "123"),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testLogoutUser() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
            tokenString = session!.accessToken
        })
        try app.test(.GET, "users/me",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.POST, "users/me/logout",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.GET, "users/me",
                     headers: .authWith(token: tokenString),
                     afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testChangePassword() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
            tokenString = session!.accessToken
        })
        try app.test(.PUT, "users/me/changePassword",
                     headers: .authWith(token: tokenString),
                     beforeRequest: { req in
            try req.content.encode(
                ChangePasswordRequest(oldPassword: CurrentUser.password, newPassword: "12345678")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: "12345678"),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func testTryChangePasswordWithIncorrectCurrentPassword() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
            tokenString = session!.accessToken
        })
        try app.test(.PUT, "users/me/changePassword",
                     headers: .authWith(token: tokenString),
                     beforeRequest: { req in
            try req.content.encode(
                ChangePasswordRequest(oldPassword: "87654321", newPassword: "12345678")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testResetPassword() async throws {
        try await seedCurrentUser()
        try app.test(.POST, "users/resetPassword",
                     beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: CurrentUser.accountKey)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: "12345678"),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func testTryResetPasswordWithInvalidAccountKey() async throws {
        try await seedCurrentUser()
        try app.test(.POST, "users/resetPassword",
                     beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: "")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testTryResetPasswordWithAccountKeyNotSet() async throws {
        try await seedCurrentUser(accountKey: nil)
        try app.test(.POST, "users/resetPassword",
                     beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: CurrentUser.accountKey)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testSetAccountKey() async throws {
        try await seedCurrentUser(accountKey: nil)
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
            tokenString = session!.accessToken
        })
        try app.test(.PUT, "users/me/setAccountKey",
                     headers: .authWith(token: tokenString),
                     beforeRequest: { req in
            try req.content.encode(
                SetAccountKeyRequest(password: CurrentUser.password, accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.POST, "users/resetPassword",
                     beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func testTrySetAccountKeyWithIncorrectCurrentPassword() async throws {
        try await seedCurrentUser(accountKey: nil)
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfo
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            let session = response.deviceSessions.first
            XCTAssertNotNil(session)
            tokenString = session!.accessToken
        })
        try app.test(.PUT, "users/me/setAccountKey",
                     headers: .authWith(token: tokenString),
                     beforeRequest: { req in
            try req.content.encode(
                SetAccountKeyRequest(password: "123", accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
}
