import Fluent

final class Contact: Model {
    static let schema = "user_contacts"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "name")
    var name: String?
    
    @Field(key: "favorite")
    var isFavorite: Bool?
    
    @Field(key: "blocked")
    var isBlocked: Bool?
    
    @Parent(key: "user_id")
    var user: User
    
    @Parent(key: "owner_id")
    var owner: User
    
    init() {}
    
    init(id: UUID? = nil, ownerId: UserID, userId: UserID, isFavorite: Bool = false, isBlocked: Bool = false, name: String? = nil) {
        self.id = id
        self.name = name
        self.isFavorite = isFavorite
        self.isBlocked = isBlocked
        self.$owner.id = ownerId
        self.$user.id = userId
    }
}

extension Contact {
    
    struct Info: Serializable {
        var id: UUID?
        var name: String?
        var isFavorite: Bool
        var isBlocked: Bool
        var user: UserInfo
        
        init(id: UUID? = nil,
             name: String?,
             isFavorite: Bool,
             isBlocked: Bool,
             user: UserInfo
        ) {
            self.id = id
            self.name = name
            self.user = user
            self.isFavorite = isFavorite
            self.isBlocked = isBlocked
        }
        
        init(from contact: Contact) {
            self.init(id: contact.id,
                      name: contact.name,
                      isFavorite: contact.isFavorite ?? false,
                      isBlocked: contact.isBlocked ?? false,
                      user: contact.user.info())
        }
        
        init(from copy: Self, id: UUID) {
            self.id = id
            self.name = copy.name
            self.user = copy.user
            self.isFavorite = copy.isFavorite
            self.isBlocked = copy.isBlocked
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}

typealias ContactInfo = Contact.Info
