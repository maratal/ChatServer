import Foundation

protocol UserService {
    
    /// Returns full information about current user including all logged in sessions.
    func current(_ user: User) async throws -> User.PrivateInfo
    
    /// Updates current user with the information from the request fields.
    func update(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo
    
    /// Finds user by `id`.
    func find(id: UserID) async throws -> UserInfo
    
    /// Looking for users with an `id`, `username` or `name` using the provided string as a substring for those fields (except `id` which should be an exact match).
    func search(_ s: String) async throws -> [UserInfo]
    
    /// Returns all contacts for the current user.
    func contacts(of user: User) async throws -> [ContactInfo]
    
    /// Adds a user as a contact of the current user.
    func addContact(_ info: ContactInfo, to user: User) async throws -> ContactInfo
    
    /// Deletes the contact of the current user.
    func deleteContact(_ contactId: UUID, from user: User) async throws
}

extension UserService {
    
    func current(_ user: User) async throws -> User.PrivateInfo {
        _ = try await Repositories.sessions.allForUser(user)
        return user.privateInfo()
    }
    
    func update(_ user: User, with info: UpdateUserRequest) async throws -> UserInfo {
        if let name = info.name {
            user.name = name
        }
        if let about = info.about {
            user.about = about
        }
        user.lastAccess = Date()
        try await Repositories.users.save(user)
        return user.fullInfo()
    }
    
    func find(id: UserID) async throws -> UserInfo {
        guard let user = try await Repositories.users.find(id: id) else {
            throw ServiceError(.notFound)
        }
        return user.fullInfo()
    }
    
    func search(_ s: String) async throws -> [UserInfo] {
        if let userId = Int(s), userId > 0 {
            return [try await find(id: userId)]
        }
        guard s.count >= 2 else {
            throw ServiceError(.notFound)
        }
        let users = try await Repositories.users.search(s)
        return users.map { $0.info() }
    }
    
    func contacts(of user: User) async throws -> [ContactInfo] {
        try await Repositories.users.contacts(of: user).map { $0.info() }
    }
    
    func addContact(_ info: ContactInfo, to user: User) async throws -> ContactInfo {
        guard let contactUserId = info.user.id else {
            throw ServiceError(.badRequest, reason: "User should have an id.")
        }
        if let contact = try await Repositories.users.findContact(userId: contactUserId, ownerId: user.id!) {
            return contact.info()
        }
        let contact = Contact(ownerId: user.id!, userId: contactUserId, isFavorite: info.isFavorite, name: info.name)
        try await Repositories.users.saveContact(contact)
        // Copy old object to avoid re-fetching data from database
        return ContactInfo(from: info, id: contact.id!)
    }
    
    func deleteContact(_ contactId: UUID, from user: User) async throws {
        guard let contact = try await Repositories.users.findContact(contactId), contact.$owner.id == user.id else {
            throw ServiceError(.notFound, reason: "Contact not found.")
        }
        try await Repositories.users.deleteContact(contact)
    }
}
