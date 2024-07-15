import Vapor
import FluentKit

final class Service {
    
    enum Environment {
        case test, live
    }
    
    var database: Database!
    
    var users: UserService!
    var chats: ChatService!
    var contacts: ContactsService!
    
    var listener: WebSocketListener!
    var notificator: Notificator!
    
    init(database: Database,
         listener: WebSocketListener,
         notificator: Notificator) {
        self.database = database
        self.listener = listener
        self.notificator = notificator
        self.users = UserService(repo: UsersDatabaseRepository(database: database))
        self.chats = ChatService(repo: ChatsDatabaseRepository(database: database))
        self.contacts = ContactsService(repo: ContactsDatabaseRepository(database: database))
    }
}

extension Service {
    
    static var shared: Service!
    
    static var live: Service {
        let wsServer = WebSocketServer()
        let pushes = PushManager(apnsKeyPath: "", fcmKeyPath: "")
        
        return Service(database: Application.shared.db,
                       listener: wsServer,
                       notificator: NotificationManager(wsSender: wsServer, pushSender: pushes))
    }
}

extension Service {
    
    func saveItem(_ item: any RepositoryItem) async throws {
        try await item.save(on: database)
    }
    
    func saveAll(_ items: [any RepositoryItem]) async throws {
        try await withThrowingTaskGroup(of: Void.self) { group in
            for item in items {
                group.addTask {
                    try await item.save(on: self.database)
                }
            }
            try await group.waitForAll()
        }
    }
}

extension Service {
    
    static let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return df
    }()
    
    enum Event: String {
        /// Chat related events
        case message
        case messageUpdate
        case chatUpdate
        case userUpdate
        case addedUsers
        case removedUsers
        case typing
        case chatCleared
        case chatDeleted
    }
    
    struct Notification: JSONSerializable {
        var event: Event
        var source: String
        var destination: String?
        var payload: JSON?
        
        func jsonObject() throws -> JSON {
            [ "event": "\(event)", "source": source, "payload": payload ]
        }
    }
    
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
        
        /// Upload errors
        static var uploadTooLarge    = ServiceError(.payloadTooLarge, reason: "Your upload exeeded max limit of 50Mb.")
    }
}

/// Errors, that should not happen in normal conditions
extension Service.Errors {
    /// Indicates some failure in the database or an attempt to use unsaved object.
    static var idRequired = ServiceError(.internalServerError, reason: "ID Required.")
}
