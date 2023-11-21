import Fluent
import Vapor

final class User: Model, Authenticatable {
    static let schema = "users"
    
    @ID(custom: .id)
    var id: Int?

    @Field(key: "name")
    var name: String

    init() { }

    init(id: Int? = nil, name: String) {
        self.id = id
        self.name = name
    }
}

struct UserInfo: Content {
    
    var id: Int
    var name: String
    
    init(from user: User, fullInfo: Bool = true) throws {
        self.id = try user.requireID()
        self.name = user.name
    }
}
