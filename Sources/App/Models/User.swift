import Fluent

final class User: Model {
    static let schema = "users"
    
    @ID(custom: .id)
    var id: Int?

    @Field(key: "name")
    var name: String

    @Field(key: "username")
    var username: String
    
    @Field(key: "password_hash")
    var passwordHash: String
    
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
        var id: Int
        var name: String
        var username: String

        init(from user: User, fullInfo: Bool = true) throws {
            self.id = try user.requireID()
            self.name = user.name
            self.username = user.username
        }
    }
    
    struct LoginInfo: Serializable {
        var info: Info
        var token: UserToken?
    }
    
    func generateToken() throws -> UserToken {
        try .init(value: [UInt8].random(count: 128).base64, userID: requireID())
    }
}

typealias UserInfo = User.Info
