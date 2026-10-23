@testable import App
import XCTVapor

final class UserTests: AppTestCase {
    
    func test_01_registerUser() throws {
        try app.test(.POST, "api/users", beforeRequest: { req in
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
    
    func test_02_deregisterUser() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.GET, "api/users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.DELETE, "api/users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.GET, "api/users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func test_03_loginUser() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        
        try await asyncTest(.GET, "api/users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let response = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(response.info.username, CurrentUser.username)
        })
        
        try await asyncTest(.GET, "api/users/me",
                            headers: .authWith(token: "fake"),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func test_04_loginUserFailure() async throws {
        try await service.seedCurrentUser()
        try await asyncTest(.POST, "api/users/login",
                            headers: .authWith(username: CurrentUser.username, password: "123"),
                            beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func test_05_currentUser() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.GET, "api/users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func test_06_logoutUser() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.GET, "api/users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "api/users/me/logout",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.GET, "api/users/me",
                            headers: .authWith(token: tokenString),
                            afterResponse: { res in
            XCTAssertEqual(res.status, .unauthorized, res.body.string)
        })
    }
    
    func test_07_changePassword() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.PUT, "api/users/me/password",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(
                ChangePasswordRequest(currentPassword: CurrentUser.password, newPassword: "12345678")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "api/users/login",
                            headers: .authWith(username: CurrentUser.username, password: "12345678"),
                            beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func test_08_tryChangePasswordWithIncorrectCurrentPassword() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.PUT, "api/users/me/password",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(
                ChangePasswordRequest(currentPassword: "87654321", newPassword: "12345678")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_09_resetPassword() async throws {
        try await service.seedCurrentUser()
        try await asyncTest(.POST, "api/users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: CurrentUser.accountKey)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "api/users/login",
                            headers: .authWith(username: CurrentUser.username, password: "12345678"),
                            beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoMobile
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func test_10_tryResetPasswordWithInvalidAccountKey() async throws {
        try await service.seedCurrentUser()
        try await asyncTest(.POST, "api/users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: "")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_11_tryResetPasswordWithAccountKeyNotSet() async throws {
        try await service.seedCurrentUser(accountKey: nil)
        try await asyncTest(.POST, "api/users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: CurrentUser.accountKey)
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_12_setAccountKey() async throws {
        try await service.seedCurrentUser(accountKey: nil)
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.PUT, "api/users/me/accountKey",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(
                SetAccountKeyRequest(password: CurrentUser.password, accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "api/users/resetPassword",
                            beforeRequest: { req in
            try req.content.encode(
                ResetPasswordRequest(userId: 1, newPassword: "12345678", accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func test_13_trySetAccountKeyWithIncorrectCurrentPassword() async throws {
        try await service.seedCurrentUser(accountKey: nil)
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.PUT, "api/users/me/accountKey",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(
                SetAccountKeyRequest(password: "123", accountKey: "\(CurrentUser.accountKey.reversed())")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
    
    func test_14_updateUser() async throws {
        try await service.seedCurrentUser()
        let about = UUID().uuidString
        try await asyncTest(.PUT, "api/users/me", headers: .none, beforeRequest: { req in
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
    
    func test_15_updateDeviceSession() async throws {
        try await service.seedCurrentUser()
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
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
        try await asyncTest(.POST, "api/users/login",
                            headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                            beforeRequest: { req in
            try req.content.encode(
                DeviceInfo.testInfoDesktop
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 1)
            tokenString = try XCTUnwrap(privateInfo.sessionForDeviceId(DeviceInfo.testInfoDesktop.id)).accessToken
        })
        try await asyncTest(.PUT, "api/users/me/device",
                            headers: .authWith(token: tokenString),
                            beforeRequest: { req in
            try req.content.encode(UpdateDeviceSessionRequest(deviceName: "My computer"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let privateInfo = try res.content.decode(User.PrivateInfo.self)
            XCTAssertEqual(privateInfo.deviceSessions.count, 1)
            let deviceInfo = try XCTUnwrap(privateInfo.sessionForAccessToken(tokenString)?.deviceInfo)
            XCTAssertEqual(deviceInfo.id, DeviceInfo.testInfoDesktop.id)
            XCTAssertEqual(deviceInfo.name, "My computer")
        })
    }
    
    func test_16_getUser() async throws {
        let (_, photo) = try await service.seedUserWithPhoto(name: "Test", username: "test")
        try await asyncTest(.GET, "api/users/1", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let user = try res.content.decode(UserInfo.self)
            XCTAssertEqual(user.id, 1)
            XCTAssertEqual(user.username, "test")
            XCTAssertEqual(user.photos?.count, 1)
            try service.removeFiles(for: photo)
        })
    }
    
    func test_17_searchUsers() async throws {
        try await service.seedUsers(count: 2, namePrefix: "Name", usernamePrefix: "user")
        try await service.seedUser(name: "Demo 1", username: "test1")
        let (_, photo) = try await service.seedUserWithPhoto(name: "Demo 2", username: "test2")
        // Search by id=2
        try await asyncTest(.GET, "api/users?s=2", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let users = try res.content.decode([UserInfo].self)
            XCTAssertEqual(users.count, 1)
            XCTAssertEqual(users[0].id, 2)
        })
        // Search by username "u(se)r*"
        try await asyncTest(.GET, "api/users?s=se", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let names = try res.content.decode([UserInfo].self).compactMap { $0.name }
            XCTAssertEqual(names.sorted(), ["Name 1", "Name 2"])
        })
        // Search by name "D(em)o *"
        try await asyncTest(.GET, "api/users?s=em", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let users = try res.content.decode([UserInfo].self).sorted(by: { $0.id! < $1.id! })
            XCTAssertEqual(users.compactMap { $0.name }, ["Demo 1", "Demo 2"])
            XCTAssertEqual(users.first?.photos?.count ?? 0, 0)
            XCTAssertEqual(users.last?.photos?.count, 1)
            try service.removeFiles(for: photo)
        })
    }
    
    func test_18_addAndDeletePhotoOfUser() async throws {
        try await service.seedCurrentUser()
        let fileId = UUID()
        let fileName = fileId.uuidString
        let fileType = "test"
        
        // "Upload" all files before adding photo
        let uploadPath = try service.makeFakeUpload(fileName: fileName + "." + fileType, fileSize: 1)
        let previewPath = try service.makeFakeUpload(fileName: fileName + "-preview." + fileType, fileSize: 1)
        XCTAssertTrue(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertTrue(FileManager.default.fileExists(atPath: previewPath))
        
        try await asyncTest(.POST, "api/users/me/photos", headers: .none, beforeRequest: { req in
            try req.content.encode(UpdateUserRequest(photo: MediaInfo(id: fileId, fileType: fileType, fileSize: 1)))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let userInfo = try res.content.decode(UserInfo.self)
            XCTAssertEqual(userInfo.photos?.count, 1)
            XCTAssertTrue(service.fileExists(for: userInfo.photos![0]))
            XCTAssertTrue(service.previewExists(for: userInfo.photos![0]))
        })
        
        try await asyncTest(.DELETE, "api/users/me/photos/\(fileId)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        
        // Check if all files were removed
        XCTAssertFalse(FileManager.default.fileExists(atPath: uploadPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: previewPath))
    }
    
    // MARK: - Pagination & Search
    
    func test_19_getAllUsersPaginated() async throws {
        try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 5, namePrefix: "Page", usernamePrefix: "page")
        
        try await asyncTest(.GET, "api/users/all?count=3", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let page1 = try res.content.decode([UserInfo].self)
            XCTAssertEqual(page1.count, 3)
            // Should be sorted by id descending
            XCTAssertTrue(page1[0].id! > page1[1].id!)
            
            let lastId = page1.last!.id!
            try await asyncTest(.GET, "api/users/all?count=3&id=\(lastId)", afterResponse: { res in
                XCTAssertEqual(res.status, .ok, res.body.string)
                let page2 = try res.content.decode([UserInfo].self)
                XCTAssertTrue(page2.count > 0)
                // All IDs on page 2 should be less than last ID on page 1
                for userInfo in page2 {
                    XCTAssertTrue(userInfo.id! < lastId)
                }
            })
        })
    }
    
    func test_20_trySearchWithTooShortQuery() async throws {
        try await service.seedCurrentUser()
        try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        
        try await asyncTest(.GET, "api/users?s=a", afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }
    
    // MARK: Recovery with a security question
    
    private func loginCurrentUser() async throws -> String {
        var tokenString = ""
        try await asyncTest(.POST, "api/users/login",
                            headers: .authWith(username: CurrentUser.username, password: CurrentUser.password),
                            beforeRequest: { req in
            try req.content.encode(DeviceInfo.testInfoMobile)
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            tokenString = try res.content.decode(User.PrivateInfo.self).deviceSessions.first!.accessToken
        })
        return tokenString
    }
    
    func test_21_registerWithSecurityQuestionAndRecover() async throws {
        try await asyncTest(.POST, "api/users", beforeRequest: { req in
            try req.content.encode(
                RegistrationRequest(name: "Test", username: "TestUser", password: "********", deviceInfo: .testInfoMobile,
                                    securityQuestion: "  What city were you born in? ", securityAnswer: "Paris")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        // The username is matched the way registration stored it, and the question comes back trimmed.
        try await asyncTest(.POST, "api/users/recover/question", beforeRequest: { req in
            try req.content.encode(RecoveryQuestionRequest(username: " testuser "))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            XCTAssertEqual(try res.content.decode(SecurityQuestionInfo.self).question, "What city were you born in?")
        })
        // The answer is compared trimmed and case-insensitively.
        try await asyncTest(.POST, "api/users/recover/reset", beforeRequest: { req in
            try req.content.encode(RecoveryResetRequest(username: "testuser", answer: " pARIS ", newPassword: "12345678"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.POST, "api/users/login",
                            headers: .authWith(username: "testuser", password: "12345678"),
                            beforeRequest: { req in
            try req.content.encode(DeviceInfo.testInfoMobile)
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func test_22_tryRegisterWithQuestionButNoAnswer() async throws {
        try await asyncTest(.POST, "api/users", beforeRequest: { req in
            try req.content.encode(
                RegistrationRequest(name: "Test", username: "testuser", password: "********", deviceInfo: .testInfoMobile,
                                    securityQuestion: "What city were you born in?", securityAnswer: "   ")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .badRequest, res.body.string)
        })
    }
    
    func test_23_tryRecoverWithoutSecurityQuestion() async throws {
        try await service.seedCurrentUser()
        // An account without a question and an unknown username get the same answer.
        for username in [CurrentUser.username, "nobody"] {
            try await asyncTest(.POST, "api/users/recover/question", beforeRequest: { req in
                try req.content.encode(RecoveryQuestionRequest(username: username))
            }, afterResponse: { res in
                XCTAssertEqual(res.status, .notFound, res.body.string)
            })
            try await asyncTest(.POST, "api/users/recover/reset", beforeRequest: { req in
                try req.content.encode(RecoveryResetRequest(username: username, answer: "anything", newPassword: "12345678"))
            }, afterResponse: { res in
                XCTAssertEqual(res.status, .forbidden, res.body.string)
            })
        }
    }
    
    func test_24_setSecurityQuestionAndRecover() async throws {
        try await service.seedCurrentUser()
        let token = try await loginCurrentUser()
        try await asyncTest(.GET, "api/users/me/security", headers: .authWith(token: token), afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            XCTAssertNil(try res.content.decode(SecurityQuestionInfo.self).question)
        })
        try await asyncTest(.PUT, "api/users/me/security", headers: .authWith(token: token), beforeRequest: { req in
            try req.content.encode(
                SetSecurityQuestionRequest(password: "wrong-password", securityQuestion: "What was the name of your first pet?", securityAnswer: "Rex")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
        try await asyncTest(.PUT, "api/users/me/security", headers: .authWith(token: token), beforeRequest: { req in
            try req.content.encode(
                SetSecurityQuestionRequest(password: CurrentUser.password, securityQuestion: "What was the name of your first pet?", securityAnswer: "Rex")
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.GET, "api/users/me/security", headers: .authWith(token: token), afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            XCTAssertEqual(try res.content.decode(SecurityQuestionInfo.self).question, "What was the name of your first pet?")
        })
        try await asyncTest(.POST, "api/users/recover/reset", beforeRequest: { req in
            try req.content.encode(RecoveryResetRequest(username: CurrentUser.username, answer: "Max", newPassword: "12345678"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
        try await asyncTest(.POST, "api/users/recover/reset", beforeRequest: { req in
            try req.content.encode(RecoveryResetRequest(username: CurrentUser.username, answer: "rex", newPassword: "12345678"))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
    }
    
    func test_25_passwordPolicy() throws {
        // A production server enforces the complexity rules.
        let production = PasswordPolicy(enforced: true)
        XCTAssertTrue(production.isValid("Passw0rd"))
        XCTAssertFalse(production.isValid("Pass0rd"))        // too short
        XCTAssertFalse(production.isValid("password1"))      // no uppercase letter
        XCTAssertFalse(production.isValid("PASSWORD1"))      // no lowercase letter
        XCTAssertFalse(production.isValid("Password"))       // no digit
        XCTAssertFalse(production.isValid("Passw0rd" + String(repeating: "x", count: 18))) // too long
        // A server running locally accepts any password that is not empty.
        let local = PasswordPolicy(enforced: false)
        XCTAssertTrue(local.isValid("1"))
        XCTAssertFalse(local.isValid(""))
    }
}
