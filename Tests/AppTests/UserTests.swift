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
    
    // Tests fake current user
    func testCurrentUser() throws {
        try app.test(.GET, "users/current", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(UserInfo.self)
            XCTAssertEqual(info.username, "test")
        })
    }
    
    func testUpdateUser() throws {
        let about = UUID().uuidString
        try app.test(.PUT, "users/current", beforeRequest: { req in
            try req.content.encode([
                "name": "Test Test",
                "about": about
            ])
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(UserInfo.self)
            XCTAssertEqual(info.username, "test")
            XCTAssertEqual(info.name, "Test Test")
            XCTAssertEqual(info.about, about)
        })
    }
    
    func testGetUser() async throws {
        try await seedUsers(count: 1)
        try app.test(.GET, "users/1", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(UserInfo.self)
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
}
