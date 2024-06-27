@testable import App
import XCTVapor

final class UserTests: XCTestCase {
    
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
                RegistrationRequest(name: "Test", username: "testuser", password: "********", deviceInfo: .testInfoMobile)
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
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testCurrentUser() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
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
    }
    
    func testLogoutUser() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
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
                DeviceInfo.testInfoMobile
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
    
    func testGoOnline() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 1)
            XCTAssertEqual(privateInfo.deviceSessions[0].deviceInfo.id, DeviceInfo.testInfoMobile.id)
        })
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoDesktop
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 2)
            tokenString = try XCTUnwrap(privateInfo.sessionForDeviceId(DeviceInfo.testInfoDesktop.id)).accessToken
        })
        try app.test(.PUT, "users/me/online",
                     headers: .authWith(token: tokenString),
                     beforeRequest: { req in
            var info = DeviceInfo.testInfoDesktop
            info.name = "My computer"
            try req.content.encode(info)
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 2)
            let deviceInfo = try XCTUnwrap(privateInfo.sessionForAccessToken(tokenString)?.deviceInfo)
            XCTAssertEqual(deviceInfo.id, DeviceInfo.testInfoDesktop.id)
            XCTAssertEqual(deviceInfo.name, "My computer")
        })
    }
    
    func testTryGoOnlineWithDifferentDeviceId() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 1)
            tokenString = try XCTUnwrap(privateInfo.sessionForDeviceId(DeviceInfo.testInfoMobile.id)).accessToken
        })
        try app.test(.PUT, "users/me/online",
                     headers: .authWith(token: tokenString),
                     beforeRequest: { req in
            var info = DeviceInfo.testInfoMobile
            info.id = UUID()
            try req.content.encode(info)
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func testTryGoOnlineWithDifferentModel() async throws {
        try await seedCurrentUser()
        var tokenString = ""
        try app.test(.POST, "users/login",
                     headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                     beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 1)
            tokenString = try XCTUnwrap(privateInfo.sessionForDeviceId(DeviceInfo.testInfoMobile.id)).accessToken
        })
        try app.test(.PUT, "users/me/online",
                     headers: .authWith(token: tokenString),
                     beforeRequest: { req in
            var info = DeviceInfo.testInfoMobile
            info.model = "iPad"
            try req.content.encode(info)
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func testUpdateUser() async throws {
        try await seedCurrentUser()
        let about = UUID().uuidString
        try app.test(.PUT, "users/me", headers: .none, beforeRequest: { req in
            try req.content.encode([
                "name": "Test Test",
                "about": about
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(UserInfo.self)
            XCTAssertEqual(info.id, 1)
            XCTAssertEqual(info.username, "admin")
            XCTAssertEqual(info.name, "Test Test")
            XCTAssertEqual(info.about, about)
        })
    }
    
    func testGetUser() async throws {
        try await seedUsers(count: 1, namePrefix: "Test", usernamePrefix: "test")
        try app.test(.GET, "users/1", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(UserInfo.self)
            XCTAssertEqual(info.id, 1)
            XCTAssertEqual(info.username, "test1")
        })
    }
    
    func testSearchUsers() async throws {
        try await seedUsers(count: 2, namePrefix: "Name", usernamePrefix: "user")
        try await seedUsers(count: 2, namePrefix: "Demo", usernamePrefix: "test")
        // Search by id=2
        try app.test(.GET, "users?s=2", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let users = try res.content.decode([UserInfo].self)
            XCTAssertEqual(users.count, 1)
            XCTAssertEqual(users[0].id, 2)
        })
        // Search by username "u(se)r*"
        try app.test(.GET, "users?s=se", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let names = try res.content.decode([UserInfo].self).compactMap { $0.name }
            XCTAssertEqual(names.sorted(), ["Name 1", "Name 2"])
        })
        // Search by name "D(em)o *"
        try app.test(.GET, "users?s=em", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let names = try res.content.decode([UserInfo].self).compactMap { $0.name }
            XCTAssertEqual(names.sorted(), ["Demo 1", "Demo 2"])
        })
    }
    
    func testAddAndDeletePhotoOfUser() async throws {
        try await seedCurrentUser()
        let fileId = UUID()
        let fileName = fileId.uuidString
        let fileType = "test"
        
        // "Upload" all files before adding photo
        let uploadPath = try app.makeFakeUpload(fileName: fileName + "." + fileType, fileSize: 1)
        let previewPath = try app.makeFakeUpload(fileName: fileName + "-preview." + fileType, fileSize: 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertTrue(FileManager.default.fileExists(atPath: previewPath))
        
        try app.test(.POST, "users/me/photos", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateUserRequest(photo: MediaInfo(id: fileId, fileType: fileType, fileSize: 1)))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let userInfo = try res.content.decode(UserInfo.self)
            XCTAssertEqual(userInfo.photos?.count, 1)
            XCTAssertEqual(userInfo.photos?[0].fileExists, true)
            XCTAssertEqual(userInfo.photos?[0].previewExists, true)
        })
        
        try app.test(.DELETE, "users/me/photos/\(fileId)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })

        // Check if all files were removed
        XCTAssertFalse(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: previewPath))
    }
}
