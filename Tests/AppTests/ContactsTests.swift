@testable import App
import XCTVapor

final class ContactsTests: AppTestCase {
    
    func test_01_getUserContacts() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 2, namePrefix: "User", usernamePrefix: "user")
        try await service.makeContact(users[0], of: current)
        try await service.makeContact(users[1], of: current)
        try await asyncTest(.GET, "users/me/contacts", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let contacts = try res.content.decode([ContactInfo].self).compactMap { $0.user.name }
            XCTAssertEqual(contacts.sorted(), ["User 1", "User 2"])
        })
    }
    
    func test_02_addUserContact() async throws {
        try await service.seedCurrentUser()
        let user = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user").first!
        try await asyncTest(.POST, "users/me/contacts", beforeRequest: { req in
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
    
    func test_03_deleteUserContact() async throws {
        let current = try await service.seedCurrentUser()
        let user = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user").first!
        let contact = try await service.makeContact(user, of: current)
        try await asyncTest(.GET, "users/me/contacts", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let contacts = try res.content.decode([ContactInfo].self).compactMap { $0.user.name }
            XCTAssertEqual(contacts, ["User 1"])
        })
        try await asyncTest(.DELETE, "users/me/contacts/\(contact.id!)", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        try await asyncTest(.GET, "users/me/contacts", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let contacts = try res.content.decode([ContactInfo].self).compactMap { $0.user.name }
            XCTAssertEqual(contacts.count, 0)
        })
    }
}
