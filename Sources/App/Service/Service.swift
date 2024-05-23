import Foundation

/// Root service object. Use only for declarations.
struct Service {
    
    enum Event: String {
        /// Chat related events
        case message
        case messageUpdate
        case chatUpdate
        case userUpdate
        case addedUsers
        case deletedUsers
        case typing
        case chatCleared
        case chatDeleted
    }
    
    struct Notification {
        var event: Event
        var source: String
        var payload: Encodable?
        
        func jsonString() -> String { "" }
    }
    
    static var listener: WebSocketListener!
    static var notificator: NotificationManager!
    
    static func configure(listener: WebSocketListener, notificator: NotificationManager) {
        Self.listener = listener
        Self.notificator = notificator
    }
    
    /// Default configuration
    static func configure() {
        let server = WebSocketServer()
        let notificator = NotificationManager(wsSender: server, pushSender: PushManager(apnsKeyPath: "", fcmKeyPath: ""))
        configure(listener: server, notificator: notificator)
    }
}

extension Service {
    
    struct Constants {
        /// Registration constants
        static var minPasswordLength = 8
        static var maxPasswordLength = 25
        static var minUsernameLength = 5
        static var maxUsernameLength = 25
        static var minAccountKeyLength = 25
        static var maxAccountKeyLength = 100
    }
    
    struct Errors {
        /// Registration errors
        static var invalidUser       = ServiceError(.notFound, reason: "User was not found.")
        static var invalidPassword   = ServiceError(.forbidden, reason: "Invalid user or password.")
        static var invalidAccountKey = ServiceError(.forbidden, reason: "Invalid user or account key.")
        static var badPassword       = ServiceError(.badRequest, reason: "Password should be at least \(Constants.minPasswordLength) characters length.")
        static var badAccountKey     = ServiceError(.badRequest, reason: "Key should be at least \(Constants.minAccountKeyLength) characters length.")
        static var badName           = ServiceError(.badRequest, reason: "Name should consist of letters.")
        static var badUsername       = ServiceError(.badRequest, reason: "Username should be at least \(Constants.minUsernameLength) characters length, start with letter and consist of letters and digits.")
    }
}

/// Errors, that should not happen in normal conditions
extension Service.Errors {
    /// Indicates some failure in the database or an attempt to use unsaved object.
    static var idRequired = ServiceError(.internalServerError, reason: "ID Required.")
}
