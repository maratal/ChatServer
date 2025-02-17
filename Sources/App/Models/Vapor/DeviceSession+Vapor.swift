import Vapor
import Fluent

extension DeviceSession: ModelTokenAuthenticatable {
    typealias User = App.User
    
    static var valueKey: KeyPath<DeviceSession, Field<String>> {
        \DeviceSession.$accessToken
    }
    
    static var userKey: KeyPath<DeviceSession, Parent<User>> {
        \DeviceSession.$user
    }
    
    var isValid: Bool {
        true
    }
}
