import Fluent
import Foundation

typealias NoteID = UUID

final class Note: RepositoryItem, @unchecked Sendable {
    static let schema = "notes"
    
    @ID(key: .id)
    var id: NoteID?
    
    @Parent(key: "source_id")
    var source: Message
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    init() {}
    
    init(id: NoteID? = nil, sourceId: MessageID) {
        self.id = id
        self.$source.id = sourceId
    }
}

extension Note {
    
    /// Lightweight reference (no message) — used when embedding in MessageInfo to avoid cycles.
    struct Ref: Serializable {
        var id: NoteID?
        var createdAt: Date?
        
        init(from note: Note) {
            self.id = note.id
            self.createdAt = note.createdAt
        }
    }
    
    struct Info: Serializable {
        var id: NoteID?
        var message: MessageInfo?
        var createdAt: Date?
        
        init(from note: Note) {
            self.id = note.id
            self.createdAt = note.createdAt
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
