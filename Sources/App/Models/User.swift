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
    
    @Children(for: \.$owner)
    var contacts: [Contact]
    
    init() { }

    init(id: Int? = nil, name: String, username: String, passwordHash: String) {
        self.id = id
        self.name = name
        self.username = username
        self.passwordHash = passwordHash
    }
}

extension User {
    
    struct Registration: Serializable {
        var name: String
        var username: String
        var password: String
    }
    
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
    
    struct LoginInfo: Serializable {
        var info: Info
        var token: UserToken?
    }
    
    func generateToken() throws -> UserToken {
        try .init(value: [UInt8].random(count: 32).base64, userID: requireID())
    }
    
    func info() -> UserInfo {
        UserInfo(from: self, fullInfo: false)
    }
    
    func fullInfo() -> UserInfo {
        UserInfo(from: self, fullInfo: true)
    }
}

typealias UserInfo = User.Info
