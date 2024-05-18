import Vapor
import Fluent

extension DeviceSession: ModelTokenAuthenticatable {
    static let valueKey = \DeviceSession.$accessToken
    static let userKey = \DeviceSession.$user

    var isValid: Bool {
        true
    }
}
