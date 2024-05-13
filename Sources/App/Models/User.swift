import Fluent

final class User: Model {
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
    
    @Children(for: \.$owner)
    var contacts: [Contact]
    
    @Children(for: \.$user)
    var chats: [ChatToUser]
    
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
        var username: String?
        var about: String?
        var lastAccess: Date?
        
        init(from user: User, fullInfo: Bool) {
            self.id = user.id
            self.name = user.name
            self.username = user.username
            if fullInfo {
                self.about = user.about
                self.lastAccess = user.lastAccess
            }
        }
    }
    
    func info() -> Info {
        Info(from: self, fullInfo: false)
    }
    
    func fullInfo() -> Info {
        Info(from: self, fullInfo: true)
    }
    
    func generateToken() throws -> UserToken {
        try .init(value: [UInt8].random(count: 32).base64, userID: requireID())
    }
}

typealias UserInfo = User.Info
