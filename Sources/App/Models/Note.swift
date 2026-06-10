import Fluent
import Foundation

typealias NoteID = UUID

final class Note: RepositoryItem, @unchecked Sendable {
    static let schema = "notes"
    
    @ID(key: .id)
    var id: NoteID?
    
    @Parent(key: "source_id")
    var source: Message

    @Field(key: "is_pinned")
    var isPinned: Bool
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    init() {}
    
    init(id: NoteID? = nil, sourceId: MessageID, isPinned: Bool = false) {
        self.id = id
        self.$source.id = sourceId
        self.isPinned = isPinned
    }
}

extension Note {
    
    /// Lightweight reference (no message) — used when embedding in MessageInfo to avoid cycles.
    struct Ref: Serializable {
        var id: NoteID?
        var createdAt: Date?
        var isPinned: Bool
        
        init(from note: Note) {
            self.id = note.id
            self.createdAt = note.createdAt
            self.isPinned = note.isPinned
        }
    }
    
    struct Info: Serializable {
        var id: NoteID?
        var message: MessageInfo?
        var createdAt: Date?
        var isPinned: Bool
        
        init(from note: Note) {
            self.id = note.id
            self.createdAt = note.createdAt
            self.isPinned = note.isPinned
            if note.$source.value != nil {
                self.message = note.source.info()
            }
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
    
    func ref() -> Ref {
        Ref(from: self)
    }
}

typealias NoteInfo = Note.Info

extension NoteInfo: JSONSerializable {
    
    func jsonObject() throws -> JSON {
        try json() as! JSON
    }
}
