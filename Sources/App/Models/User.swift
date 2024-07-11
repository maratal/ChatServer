import Fluent
import Foundation

final class User: RepositoryItem {
    static let schema = "users"
    
    @ID(custom: .id)
    var id: Int?

    @Field(key: "name")
    var name: String

    @Field(key: "username")
    var username: String
    
    @Field(key: "about")
    var about: String?
    
    @Field(key: "last_access")
    var lastAccess: Date?
    
    @Field(key: "password_hash")
    var passwordHash: String
    
    @Field(key: "account_key_hash")
    var accountKeyHash: String?
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?
    
    @Children(for: \.$owner)
    var contacts: [Contact]
    
    @Children(for: \.$user)
    var chats: [ChatToUser]
    
    @Children(for: \.$user)
    var deviceSessions: [DeviceSession]
    
    @Children(for: \.$photoOf)
    var photos: [MediaResource]
    
    init() { }

    init(id: Int? = nil, name: String, username: String, passwordHash: String, accountKeyHash: String?) {
        self.id = id
        self.name = name
        self.username = username
        self.passwordHash = passwordHash
        self.accountKeyHash = accountKeyHash
        self.about = nil
        self.lastAccess = nil
    }
}

extension User {
    
    struct Info: Serializable {
        var id: Int?
        var name: String?
        var username: String
        var about: String?
        var lastAccess: Date?
        var photos: [MediaInfo]?
        
        init(from user: User, fullInfo: Bool) {
            self.id = user.id
            self.name = user.name
            self.username = user.username
            if user.$photos.value != nil {
                self.photos = user.photos.map { $0.info() }
            }
            if fullInfo {
                self.about = user.about
                self.lastAccess = user.lastAccess
            }
        }
    }
    
    struct PrivateInfo: Serializable {
        var info: Info
        var deviceSessions: [DeviceSession.Info]
        
        init(from user: User) {
            self.info = user.fullInfo()
            self.deviceSessions = user.deviceSessions.map { $0.info() }
        }
    }
    
    func info() -> Info {
        Info(from: self, fullInfo: false)
    }
    
    func fullInfo() -> Info {
        Info(from: self, fullInfo: true)
    }
    
    func privateInfo() -> PrivateInfo {
        PrivateInfo(from: self)
    }
}

typealias UserInfo = User.Info
