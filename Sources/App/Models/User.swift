import Fluent
import Vapor

final class User: Model, Content {
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
