@testable import App
import XCTVapor

final class MediaStorageTests: AppTestCase {
    
    func test_01_getRecentMedia() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let (_, resource) = try await service.makeMessageWithAttachment(for: chat.id!, authorId: current.id!, text: "With attachment")
        
        try await asyncTest(.GET, "media/recents", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let media = try res.content.decode([MediaInfo].self)
            XCTAssertEqual(media.count, 1)
            XCTAssertEqual(media.first?.id, resource.id)
        })
    }
    
    func test_02_getRecentMediaPaginated() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        
        for _ in 1...5 {
            try await service.makeMessageWithAttachment(for: chat.id!, authorId: current.id!)
        }
        
        try await asyncTest(.GET, "media/recents?offset=0&limit=3", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let page1 = try res.content.decode([MediaInfo].self)
            XCTAssertEqual(page1.count, 3)
        })
        
        try await asyncTest(.GET, "media/recents?offset=3&limit=3", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let page2 = try res.content.decode([MediaInfo].self)
            XCTAssertEqual(page2.count, 2)
        })
    }
    
    func test_03_deleteMedia() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let (_, resource) = try await service.makeMessageWithAttachment(for: chat.id!, authorId: current.id!, text: "Del me")
        
        let resourceInfo = resource.info()
        XCTAssertTrue(service.fileExists(for: resourceInfo))
        XCTAssertTrue(service.previewExists(for: resourceInfo))
        
        try await asyncTest(.DELETE, "media/\(resource.id!)", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })
        
        XCTAssertFalse(service.fileExists(for: resourceInfo))
        XCTAssertFalse(service.previewExists(for: resourceInfo))
        
        // Verify it's gone from recent media
        try await asyncTest(.GET, "media/recents", afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let media = try res.content.decode([MediaInfo].self)
            XCTAssertTrue(media.isEmpty)
        })
    }
    
    func test_04_tryDeleteOtherUsersMedia() async throws {
        let current = try await service.seedCurrentUser()
        let users = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")
        let chat = try await service.makeChat(ownerId: current.id!, users: users.map { $0.id! }, isPersonal: true)
        let (_, resource) = try await service.makeMessageWithAttachment(for: chat.id!, authorId: users[0].id!, text: "Not yours")
        
        try await asyncTest(.DELETE, "media/\(resource.id!)", afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
        
        // Verify files still exist
        let resourceInfo = resource.info()
        XCTAssertTrue(service.fileExists(for: resourceInfo))
    }
}
