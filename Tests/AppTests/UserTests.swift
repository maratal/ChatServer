@testable import App
import XCTVapor

final class UserTests: AppTestCase {
    
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
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.GET, "users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.DELETE, "users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.GET, "users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testLoginUser() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        
        try await asyncTest(.GET, "users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(response.info.username, CurrentUser.username)
        })
        
        try await asyncTest(.GET, "users/me",
                            headers: .authWith(token: "fake"),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testLoginUserFailure() async throws {
        try await service.seedCurrentUser()
        try await asyncTest(.POST, "users/login",
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
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.GET, "users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func testLogoutUser() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.GET, "users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "users/me/logout",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.GET, "users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func testChangePassword() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.PUT, "users/me/changePassword",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(
                ChangePasswordRequest(oldPassword: CurrentUser.password, newPassword: "12345678")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "users/login",
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
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.PUT, "users/me/changePassword",
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
        try await service.seedCurrentUser()
        try await asyncTest(.POST, "users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: CurrentUser.accountKey)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "users/login",
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
        try await service.seedCurrentUser()
        try await asyncTest(.POST, "users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: "")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testTryResetPasswordWithAccountKeyNotSet() async throws {
        try await service.seedCurrentUser(accountKey: nil)
        try await asyncTest(.POST, "users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: CurrentUser.accountKey)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testSetAccountKey() async throws {
        try await service.seedCurrentUser(accountKey: nil)
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.PUT, "users/me/setAccountKey",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(
                SetAccountKeyRequest(password: CurrentUser.password, accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func testTrySetAccountKeyWithIncorrectCurrentPassword() async throws {
        try await service.seedCurrentUser(accountKey: nil)
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.PUT, "users/me/setAccountKey",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(
                SetAccountKeyRequest(password: "123", accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func testUpdateUser() async throws {
        try await service.seedCurrentUser()
        let about = UUID().uuidString
        try await asyncTest(.PUT, "users/me", headers: .none, beforeRequest: { req in
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
    
    func testUpdateDeviceSession() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.POST, "users/login",
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
        try await asyncTest(.PUT, "users/me/device",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(UpdateDeviceSessionRequest(deviceName: "My computer"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 2)
            let deviceInfo = try XCTUnwrap(privateInfo.sessionForAccessToken(tokenString)?.deviceInfo)
            XCTAssertEqual(deviceInfo.id, DeviceInfo.testInfoDesktop.id)
            XCTAssertEqual(deviceInfo.name, "My computer")
        })
    }
    
    func testGetUser() async throws {
        let (_, photo) = try await service.seedUserWithPhoto(name: "Test", username: "test")
        try await asyncTest(.GET, "users/1", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let user = try res.content.decode(UserInfo.self)
            XCTAssertEqual(user.id, 1)
            XCTAssertEqual(user.username, "test")
            XCTAssertEqual(user.photos?.count, 1)
            try service.removeFiles(for: photo)
        })
    }
    
    func testSearchUsers() async throws {
        try await service.seedUsers(count: 2, namePrefix: "Name", usernamePrefix: "user")
        try await service.seedUser(name: "Demo 1", username: "test1")
        let (_, photo) = try await service.seedUserWithPhoto(name: "Demo 2", username: "test2")
        // Search by id=2
        try await asyncTest(.GET, "users?s=2", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let users = try res.content.decode([UserInfo].self)
            XCTAssertEqual(users.count, 1)
            XCTAssertEqual(users[0].id, 2)
        })
        // Search by username "u(se)r*"
        try await asyncTest(.GET, "users?s=se", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let names = try res.content.decode([UserInfo].self).compactMap { $0.name }
            XCTAssertEqual(names.sorted(), ["Name 1", "Name 2"])
        })
        // Search by name "D(em)o *"
        try await asyncTest(.GET, "users?s=em", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let users = try res.content.decode([UserInfo].self).sorted(by: { $0.id! < $1.id! })
            XCTAssertEqual(users.compactMap { $0.name }, ["Demo 1", "Demo 2"])
            XCTAssertEqual(users.first?.photos?.count, 0)
            XCTAssertEqual(users.last?.photos?.count, 1)
            try service.removeFiles(for: photo)
        })
    }
    
    func testAddAndDeletePhotoOfUser() async throws {
        try await service.seedCurrentUser()
        let fileId = UUID()
        let fileName = fileId.uuidString
        let fileType = "test"
        
        // "Upload" all files before adding photo
        let uploadPath = try service.makeFakeUpload(fileName: fileName + "." + fileType, fileSize: 1)
        let previewPath = try service.makeFakeUpload(fileName: fileName + "-preview." + fileType, fileSize: 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertTrue(FileManager.default.fileExists(atPath: previewPath))
        
        try await asyncTest(.POST, "users/me/photos", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateUserRequest(photo: MediaInfo(id: fileId, fileType: fileType, fileSize: 1)))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let userInfo = try res.content.decode(UserInfo.self)
            XCTAssertEqual(userInfo.photos?.count, 1)
            XCTAssertTrue(service.fileExists(for: userInfo.photos![0]))
            XCTAssertTrue(service.previewExists(for: userInfo.photos![0]))
        })
        
        try await asyncTest(.DELETE, "users/me/photos/\(fileId)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        
        // Check if all files were removed
        XCTAssertFalse(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: previewPath))
    }
}
