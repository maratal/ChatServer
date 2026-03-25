import FluentKit
import Foundation

protocol NotesRepository: Sendable {
    func find(id: NoteID) async throws -> Note?
    func findBySource(messageId: MessageID) async throws -> Note?
    func findBySourceIds(messageIds: [MessageID]) async throws -> [MessageID: Note]
    func notes(for userId: UserID, before noteId: NoteID?, count: Int) async throws -> [Note]
    func save(_ note: Note) async throws
    func delete(_ note: Note) async throws
}

actor NotesDatabaseRepository: DatabaseRepository, NotesRepository {
    
    let database: any Database
    
    init(database: any Database) {
        self.database = database
    }
    
    func find(id: NoteID) async throws -> Note? {
        try await Note.query(on: database)
            .filter(\.$id == id)
            .with(\.$source) { message in
                message.with(\.$author) { author in
                    author.with(\.$photos)
                }
                message.with(\.$attachmentPivots) { pivot in
                    pivot.with(\.$mediaResource)
                }
            }
            .first()
    }
    
    func findBySource(messageId: MessageID) async throws -> Note? {
        try await Note.query(on: database)
            .filter(\.$source.$id == messageId)
            .first()
    }
    
    func findBySourceIds(messageIds: [MessageID]) async throws -> [MessageID: Note] {
        guard !messageIds.isEmpty else { return [:] }
        let notes = try await Note.query(on: database)
            .filter(\.$source.$id ~~ messageIds)
            .all()
        var result: [MessageID: Note] = [:]
        for note in notes {
            result[note.$source.id] = note
        }
        return result
    }
    
    func notes(for userId: UserID, before noteId: NoteID?, count: Int) async throws -> [Note] {
        var query = Note.query(on: database)
            .join(Message.self, on: \Note.$source.$id == \Message.$id)
            .join(Chat.self, on: \Message.$chat.$id == \Chat.$id)
            .filter(Message.self, \.$author.$id == userId)
            .filter(Chat.self, \.$isPersonal == true)
        
        if let noteId = noteId {
            // Get the note to find its creation date for cursor pagination
            if let cursorNote = try await Note.find(noteId, on: database) {
                if let createdAt = cursorNote.createdAt {
                    query = query.filter(\.$createdAt < createdAt)
                }
            }
        }
        
        return try await query
            .sort(\.$createdAt, .descending)
            .range(..<count)
            .with(\.$source) { message in
                message.with(\.$author) { author in
                    author.with(\.$photos)
                }
                message.with(\.$attachmentPivots) { pivot in
                    pivot.with(\.$mediaResource)
                }
            }
            .all()
    }
    
    func save(_ note: Note) async throws {
        try await note.save(on: database)
    }
    
    func delete(_ note: Note) async throws {
        try await note.delete(on: database)
    }
}
