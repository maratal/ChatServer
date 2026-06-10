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
    
    /// Returns paginated published notes for a given user. Public access (no auth required).
    func notes(for userId: UserID, before noteId: NoteID?, count: Int, pinned: Bool) async throws -> [NoteInfo]
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
        guard note.source.author.id == userId else {
            throw ServiceError(.notFound)
        }
        return note.info()
    }
    
    func notes(for userId: UserID, before noteId: NoteID?, count: Int, pinned: Bool) async throws -> [NoteInfo] {
        let notes = try await repo.notes(for: userId, before: noteId, count: count, pinned: pinned)
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
            let pinned = try await repo.notes(for: userId, before: nil, count: Self.maxPinnedNotes, pinned: true)
            guard pinned.count < Self.maxPinnedNotes else {
                throw ServiceError(.badRequest, reason: "You can pin at most \(Self.maxPinnedNotes) notes.")
            }
        }
        note.isPinned = isPinned
        try await repo.save(note)
        return note.info()
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
