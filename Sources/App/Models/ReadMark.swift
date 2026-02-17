import Fluent
import Foundation

final class ReadMark: RepositoryItem, @unchecked Sendable /* https://blog.vapor.codes/posts/fluent-models-and-sendable */ {
    static let schema = "read_marks"
    
    @ID(key: .id)
    var id: UUID?
    
    @Parent(key: "message_id")
    var message: Message
    
    @Parent(key: "user_id")
    var user: User
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    init() {}
    
    init(id: UUID? = nil, messageId: MessageID, userId: UserID) {
        self.id = id
        self.$message.id = messageId
        self.$user.id = userId
    }
}

extension ReadMark {
    
    struct Info: Serializable {
        var id: UUID?
        var user: UserInfo?
        var createdAt: Date?
        
        init(from source: ReadMark) {
            self.id = source.id
            self.user = UserInfo(id: source.$user.id)
            self.createdAt = source.createdAt
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}
