import Fluent

final class Contact: Model {
    static let schema = "user_contacts"
    
    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "name")
    var name: String?
    
    @Field(key: "favorite")
    var isFavorite: Bool
    
    @Field(key: "blocked")
    var isBlocked: Bool
    
    @Parent(key: "user_id")
    var user: User
    
    @Parent(key: "owner_id")
    var owner: User
    
    init() {}
    
    init(id: UUID? = nil, name: String? = nil, ownerId: UserID, userId: UserID) {
        self.id = id
        self.name = name
        self.owner.id = ownerId
        self.user.id = userId
    }
}

extension Contact {
    
    struct Info: Serializable {
        var id: UUID?
        var name: String?
        var isFavorite: Bool
        var isBlocked: Bool
        var user: UserInfo
        var owner: UserInfo
        
        init(id: UUID? = nil,
             name: String?,
             isFavorite: Bool,
             isBlocked: Bool,
             user: User,
             owner: User
        ) {
            self.id = id
            self.name = name
            self.user = UserInfo(from: user, fullInfo: false)
            self.owner = UserInfo(from: owner, fullInfo: false)
            self.isFavorite = isFavorite
            self.isBlocked = isBlocked
        }
        
        init(from contact: Contact) {
            self.init(id: contact.id,
                      name: contact.name,
                      isFavorite: contact.isFavorite,
                      isBlocked: contact.isBlocked,
                      user: contact.user,
                      owner: contact.owner)
        }
    }
    
    func info() -> ContactInfo {
        ContactInfo(from: self)
    }
}

typealias ContactInfo = Contact.Info
