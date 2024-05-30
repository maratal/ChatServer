@testable import App
import XCTVapor

final class ContactsTests: XCTestCase {
    
    var app: Application!
    
    override func setUp() {
        app = try! Application.testable()
    }
    
    override func tearDown() {
        app.shutdown()
    }
    
    func testGetUserContacts() async throws {
        let current = try await seedCurrentUser()
        let users = try await seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        try await makeContact(users[0], of: current)
        try await makeContact(users[1], of: current)
        try app.test(.GET, "users/me/contacts", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let contacts = try res.content.decode([ContactInfo].self).compactMap { $0.user.name }
            XCTAssertEqual(contacts.sorted(), ["User 1", "User 2"])
        })
    }
    
    func testAddUserContact() async throws {
        try await seedCurrentUser()
        let user = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user").first!
        try app.test(.POST, "users/me/contacts", beforeRequest: { req in
            try req.content.encode(
                ContactInfo(name: user.name, isFavorite: true, isBlocked: false, user: user.info())
            )
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let info = try res.content.decode(ContactInfo.self)
            XCTAssertEqual(info.name, user.name)
            XCTAssertEqual(info.isFavorite, true)
            XCTAssertEqual(info.user.id, user.id)
        })
    }
    
    func testDeleteUserContact() async throws {
        let current = try await seedCurrentUser()
        let user = try await seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user").first!
        let contact = try await makeContact(user, of: current)
        try app.test(.GET, "users/me/contacts", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let contacts = try res.content.decode([ContactInfo].self).compactMap { $0.user.name }
            XCTAssertEqual(contacts, ["User 1"])
        })
        try app.test(.DELETE, "users/me/contacts/\(contact.id!)", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try app.test(.GET, "users/me/contacts", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let contacts = try res.content.decode([ContactInfo].self).compactMap { $0.user.name }
            XCTAssertEqual(contacts.count, 0)
        })
    }
}
