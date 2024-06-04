import FluentKit

struct Service {
    
    static var database: Database!
    
    static var users: UserService!
    static var chats: ChatService!
    static var contacts: ContactsService!
    
    static var listener: WebSocketListener!
    static var notificator: Notificator!
    
    static func configure(database: Database,
                          listener: WebSocketListener,
                          notificator: Notificator) {
        self.database = database
        self.users = UserService(repo: UsersDatabaseRepository(database: database))
        self.chats = ChatService(repo: ChatsDatabaseRepository(database: database))
        self.contacts = ContactsService(repo: ContactsDatabaseRepository(database: database))
        self.listener = listener
        self.notificator = notificator
    }
}

extension Service {
    
    static func saveItem(_ item: any RepositoryItem) async throws {
        try await item.save(on: database)
    }
    
    static func saveAll(_ items: [any RepositoryItem]) async throws {
        try await withThrowingTaskGroup(of: Void.self) { group in
            for item in items {
                group.addTask {
                    try await item.save(on: database)
                }
            }
            try await group.waitForAll()
        }
    }
}

extension Service {
    
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
    
    struct Notification {
        var event: Event
        var source: String
        var destination: String?
        var payload: Encodable?
        
        func jsonString() -> String { "" }
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
    }
}

/// Errors, that should not happen in normal conditions
extension Service.Errors {
    /// Indicates some failure in the database or an attempt to use unsaved object.
    static var idRequired = ServiceError(.internalServerError, reason: "ID Required.")
}
