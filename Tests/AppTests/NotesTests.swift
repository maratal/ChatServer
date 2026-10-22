@testable import App
import XCTVapor
import Fluent

final class NotesTests: AppTestCase {

    // MARK: - Helpers

    /// Creates the Personal Notes chat of the user (a personal chat with only that user in it).
    private func makeNotesChat(of user: User) async throws -> Chat {
        try await service.makeChat(ownerId: user.requireID(), users: [user.requireID()], isPersonal: true)
    }

    /// Publishes a message directly in the database, bypassing the API checks.
    @discardableResult
    private func publishDirectly(_ message: Message) async throws -> Note {
        let note = Note(sourceId: try message.requireID())
        try await note.save(on: app.db)
        return note
    }

    private func publishedNotes(of userId: UserID, query: String = "") async throws -> [NoteInfo] {
        var notes = [NoteInfo]()
        try await asyncTest(.GET, "api/users/\(userId)/notes?all=true\(query)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            notes = try res.content.decode([NoteInfo].self)
        })
        return notes
    }

    // MARK: - Publishing

    func test_01_publishOwnNote() async throws {
        let current = try await service.seedCurrentUser()
        let chat = try await makeNotesChat(of: current)
        let message = try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "My post")

        try await asyncTest(.POST, "api/notes/publish", headers: .none, beforeRequest: { req in
            try req.content.encode(PublishNoteRequest(messageId: message.id!))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
        })

        let notes = try await publishedNotes(of: current.id!)
        XCTAssertEqual(notes.map { $0.message?.id }, [message.id])
    }

    func test_02_tryPublishOtherUsersNote() async throws {
        try await service.seedCurrentUser()
        let victim = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")[0]
        let chat = try await makeNotesChat(of: victim)
        let message = try await service.makeMessage(for: chat.id!, authorId: victim.id!, text: "Private post")

        try await asyncTest(.POST, "api/notes/publish", headers: .none, beforeRequest: { req in
            try req.content.encode(PublishNoteRequest(messageId: message.id!))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })

        let notes = try await publishedNotes(of: victim.id!)
        XCTAssertTrue(notes.isEmpty)
    }

    func test_03_tryPublishMessageFromOneToOneChat() async throws {
        let current = try await service.seedCurrentUser()
        let other = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")[0]
        let chat = try await service.makeChat(ownerId: current.id!, users: [other.id!], isPersonal: true)
        let message = try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Just between us")

        try await asyncTest(.POST, "api/notes/publish", headers: .none, beforeRequest: { req in
            try req.content.encode(PublishNoteRequest(messageId: message.id!))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }

    func test_04_tryPublishNonexistentMessage() async throws {
        try await service.seedCurrentUser()

        try await asyncTest(.POST, "api/notes/publish", headers: .none, beforeRequest: { req in
            try req.content.encode(PublishNoteRequest(messageId: 999_999))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }

    func test_05_tryUnpublishOtherUsersNote() async throws {
        try await service.seedCurrentUser()
        let victim = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")[0]
        let chat = try await makeNotesChat(of: victim)
        let message = try await service.makeMessage(for: chat.id!, authorId: victim.id!, text: "Public post")
        try await publishDirectly(message)

        try await asyncTest(.POST, "api/notes/unpublish", headers: .none, beforeRequest: { req in
            try req.content.encode(PublishNoteRequest(messageId: message.id!))
        }, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })

        let notes = try await publishedNotes(of: victim.id!)
        XCTAssertEqual(notes.count, 1)
    }

    func test_06_notesFromOtherChatsAreNotListed() async throws {
        let current = try await service.seedCurrentUser()
        let other = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")[0]
        // A note that points to a one-to-one chat message, as could have been created before publishing was restricted
        let chat = try await service.makeChat(ownerId: current.id!, users: [other.id!], isPersonal: true)
        let message = try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Just between us")
        let note = try await publishDirectly(message)

        let notes = try await publishedNotes(of: current.id!)
        XCTAssertTrue(notes.isEmpty)

        try await asyncTest(.GET, "api/users/\(current.id!)/notes/\(note.id!)", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .notFound, res.body.string)
        })
    }

    // MARK: - Search

    func test_07_searchFindsOnlyPublishedNotes() async throws {
        let current = try await service.seedCurrentUser()
        let chat = try await makeNotesChat(of: current)
        try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Secret plan")
        let published = try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Public plan")
        try await publishDirectly(published)

        let planNotes = try await publishedNotes(of: current.id!, query: "&search=PLAN")
        XCTAssertEqual(planNotes.map { $0.message?.id }, [published.id])

        let secretNotes = try await publishedNotes(of: current.id!, query: "&search=secret")
        XCTAssertTrue(secretNotes.isEmpty)
    }

    func test_08_searchTreatsWildcardsLiterally() async throws {
        let current = try await service.seedCurrentUser()
        let chat = try await makeNotesChat(of: current)
        let plain = try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Plain post")
        let percent = try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Up 100% today")
        try await publishDirectly(plain)
        try await publishDirectly(percent)

        let notes = try await publishedNotes(of: current.id!, query: "&search=%25")
        XCTAssertEqual(notes.map { $0.message?.id }, [percent.id])
    }

    func test_09_searchOwnNotesChatMessages() async throws {
        let current = try await service.seedCurrentUser()
        let chat = try await makeNotesChat(of: current)
        try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Garden plan")
        try await service.makeMessage(for: chat.id!, authorId: current.id!, text: "Reading list")

        try await asyncTest(.GET, "api/chats/\(chat.id!)/messages?search=garden", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .ok, res.body.string)
            let messages = try res.content.decode([MessageInfo].self)
            XCTAssertEqual(messages.map { $0.text }, ["Garden plan"])
        })
    }

    func test_10_trySearchOtherUsersNotesChat() async throws {
        try await service.seedCurrentUser()
        let victim = try await service.seedUsers(count: 1, namePrefix: "User", usernamePrefix: "user")[0]
        let chat = try await makeNotesChat(of: victim)
        try await service.makeMessage(for: chat.id!, authorId: victim.id!, text: "Secret plan")

        try await asyncTest(.GET, "api/chats/\(chat.id!)/messages?search=secret", headers: .none, afterResponse: { res in
            XCTAssertEqual(res.status, .forbidden, res.body.string)
        })
    }
}
