/**
 * This file abstracts notes logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol NotesServiceProtocol: LoggedIn {
    
    /// Publishes a message as a public note. The message must belong to the current user's personal notes chat.
    func publish(messageId: MessageID, by userId: UserID) async throws -> NoteInfo
    
    /// Unpublishes a note by removing it.
    func unpublish(messageId: MessageID, by userId: UserID) async throws
    
    /// Checks if a message is published as a note.
    func isPublished(messageId: MessageID) async throws -> Bool
    
    /// Returns paginated published notes for a given user. Public access (no auth required).
    func notes(for userId: UserID, before noteId: NoteID?, count: Int) async throws -> [NoteInfo]
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
    
    func isPublished(messageId: MessageID) async throws -> Bool {
        let note = try await repo.findBySource(messageId: messageId)
        return note != nil
    }
    
    func notes(for userId: UserID, before noteId: NoteID?, count: Int) async throws -> [NoteInfo] {
        let notes = try await repo.notes(for: userId, before: noteId, count: count)
        return notes.map { $0.info() }
    }
}
