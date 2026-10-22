/**
 * This file abstracts notes logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol NotesServiceProtocol: LoggedIn {
    
    /// Publishes a message as a public note. The message must belong to the current user's personal notes chat.
    func publish(messageId: MessageID, by userId: UserID) async throws -> NoteInfo
    
    /// Unpublishes a note by removing it.
    func unpublish(messageId: MessageID, by userId: UserID) async throws

    /// Pins a published note so it stays at the top of the public notes list.
    /// At most `NotesService.maxPinnedNotes` notes can be pinned.
    func pinNote(id: NoteID) async throws -> NoteInfo

    /// Removes the pinned flag from a published note.
    func unpinNote(id: NoteID) async throws -> NoteInfo
    
    /// Checks if a message is published as a note.
    func isPublished(messageId: MessageID) async throws -> Bool

    /// Returns a single published note for a particular journal owner. Public access (no auth required).
    func note(_ id: NoteID, for userId: UserID) async throws -> NoteInfo
    
    /// Returns paginated published notes for a given user, newest first, filtered by language code. Public access (no auth required).
    /// A nil language returns all notes regardless of their language. A nil `pinned` returns pinned and unpinned notes together.
    /// A non-blank `search` keeps only the notes whose text contains it; only published notes are ever searched.
    func notes(for userId: UserID, before noteId: NoteID?, count: Int, pinned: Bool?, languageCode: String?, search: String?) async throws -> [NoteInfo]
}

actor NotesService: NotesServiceProtocol {
    
    private let core: CoreService
    let repo: NotesRepository
    var currentUser: User?
    
    init(core: CoreService, repo: NotesRepository) {
        self.core = core
        self.repo = repo
    }
    
    func with(_ currentUser: User?) -> NotesService {
        self.currentUser = currentUser
        return self
    }
    
    func publish(messageId: MessageID, by userId: UserID) async throws -> NoteInfo {
        try await requireOwnNotesMessage(messageId, of: userId, allowDeleted: false)
        // Check if already published
        if let existing = try await repo.findBySource(messageId: messageId) {
            // Already published, return existing
            if let note = try await repo.find(id: existing.id!) {
                return note.info()
            }
            return existing.info()
        }
        
        let note = Note(sourceId: messageId)
        try await repo.save(note)
        
        // Reload to get relations
        if let saved = try await repo.find(id: note.id!) {
            return saved.info()
        }
        return note.info()
    }
    
    func unpublish(messageId: MessageID, by userId: UserID) async throws {
        try await requireOwnNotesMessage(messageId, of: userId, allowDeleted: true)
        guard let note = try await repo.findBySource(messageId: messageId) else {
            throw ServiceError(.notFound, reason: "Note not found for this message.")
        }
        try await repo.delete(note)
    }

    func pinNote(id: NoteID) async throws -> NoteInfo {
        try await setPinned(true, noteId: id)
    }

    func unpinNote(id: NoteID) async throws -> NoteInfo {
        try await setPinned(false, noteId: id)
    }
    
    func isPublished(messageId: MessageID) async throws -> Bool {
        let note = try await repo.findBySource(messageId: messageId)
        return note != nil
    }

    func note(_ id: NoteID, for userId: UserID) async throws -> NoteInfo {
        guard let note = try await repo.find(id: id) else {
            throw ServiceError(.notFound)
        }
        guard note.source.author.id == userId, Self.isNotesChat(note.source.chat, of: userId) else {
            throw ServiceError(.notFound)
        }
        return note.info()
    }
    
    func notes(for userId: UserID, before noteId: NoteID?, count: Int, pinned: Bool?, languageCode: String?, search: String?) async throws -> [NoteInfo] {
        if let languageCode, !Language.isValidCode(languageCode) {
            throw ServiceError(.badRequest, reason: "Invalid language code.")
        }
        let notes = try await repo.notes(for: userId, before: noteId, count: count, pinned: pinned, languageCode: languageCode, search: search)
        return notes.map { $0.info() }
    }

    static let maxPinnedNotes = 7

    private func setPinned(_ isPinned: Bool, noteId: NoteID) async throws -> NoteInfo {
        let note = try await requireOwnedNote(noteId)
        guard note.isPinned != isPinned else {
            return note.info()
        }
        if isPinned {
            let userId = try note.source.author.requireID()
            guard try await repo.pinnedCount(for: userId) < Self.maxPinnedNotes else {
                throw ServiceError(.badRequest, reason: "You can pin at most \(Self.maxPinnedNotes) notes.")
            }
        }
        note.isPinned = isPinned
        try await repo.save(note)
        return note.info()
    }

    /// Whether `chat` is the Personal Notes chat of the user (a personal chat with only that user in it).
    private static func isNotesChat(_ chat: Chat, of userId: UserID) -> Bool {
        chat.isPersonal && chat.participantsKey == Set([userId]).participantsKey()
    }

    /// Makes sure the message was written by the user in their own Personal Notes chat.
    /// Only such messages may be published, so that nobody can publish (and expose) somebody else's private posts.
    /// Responds with "not found" either way, so that message ids of other users can't be probed.
    @discardableResult
    private func requireOwnNotesMessage(_ messageId: MessageID, of userId: UserID, allowDeleted: Bool) async throws -> Message {
        guard let message = try await repo.findSourceMessage(id: messageId),
              message.$author.id == userId,
              Self.isNotesChat(message.chat, of: userId),
              allowDeleted || message.deletedAt == nil else {
            throw ServiceError(.notFound, reason: "Message not found.")
        }
        return message
    }

    private func requireOwnedNote(_ noteId: NoteID) async throws -> Note {
        guard let currentUser else {
            throw ServiceError(.unauthorized)
        }
        let currentUserId = try currentUser.requireID()
        guard let note = try await repo.find(id: noteId) else {
            throw ServiceError(.notFound, reason: "Note not found.")
        }
        guard note.source.author.id == currentUserId else {
            throw ServiceError(.notFound)
        }
        return note
    }
}
