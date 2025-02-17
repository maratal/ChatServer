import Vapor
import Fluent

extension User: ModelAuthenticatable {

    static var usernameKey: KeyPath<User, Field<String>> {
        \User.$username
    }

    static var passwordHashKey: KeyPath<User, Field<String>> {
        \User.$passwordHash
    }

    func verify(password: String) throws -> Bool {
        try Bcrypt.verify(password, created: self.passwordHash)
    }
    
    func verify(accountKey: String) throws -> Bool {
        guard let hash = self.accountKeyHash else { return false }
        return try Bcrypt.verify(accountKey, created: hash)
    }
}
