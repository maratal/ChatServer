import Vapor
import FluentKit

struct CoreService: Sendable {
    enum Environment {
        case live, test
    }
    
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
    
    struct Notification: Sendable, JSONSerializable {
        var event: Event
        var source: String
        var destination: String?
        var payload: JSON?
        
        func jsonObject() -> JSON {
            [ "event": "\(event)", "source": source, "payload": payload ]
        }
    }
    
    private let app: Application
    
    var wsServer: WebSocketServer!
    var notificator: Notificator!
    
    var database: Database { app.db }
    
    var logger: Logger { app.logger }
    
    lazy var users: UserService = UserService(core: self, repo: UsersDatabaseRepository(database: app.db))
    lazy var chats: ChatService = ChatService(core: self, repo: ChatsDatabaseRepository(core: self))
    lazy var contacts: ContactsService = ContactsService(repo: ContactsDatabaseRepository(database: app.db))
    
    init(app: Application) {
        self.app = app
    }
}

extension CoreService {

    static func live(_ app: Application) -> CoreService {
        var service = CoreService(app: app)
        
        let wsManager = WebSocketManager(core: service)
        let pushSender = PushManager(core: service, apnsKeyPath: "", fcmKeyPath: "")
        
        service.wsServer = wsManager
        service.notificator = NotificationManager(webSocket: wsManager, push: pushSender)
        
        return service
    }
}

// MARK: Files

extension Application {
    
    var uploadsDirectory: String {
        directory.publicDirectory
    }
    
    func uploadPath(for fileName: String) -> String {
        uploadsDirectory + fileName
    }
    
    func createUploadsDirectory() throws {
        try FileManager.default.createDirectory(atPath: uploadsDirectory, withIntermediateDirectories: true, attributes: nil)
    }
}

extension MediaResource {
    
    var fileName: String? {
        guard let fileName = self.id else { return nil }
        return "\(fileName).\(fileType)"
    }
    
    var previewFileName: String? {
        guard let fileName = self.id else { return nil }
        return "\(fileName)-preview.\(fileType)"
    }
}

extension CoreService {
    
    var uploadsDirectory: String {
        app.uploadsDirectory
    }
    
    func uploadPath(for fileName: String) -> String {
        app.uploadPath(for: fileName)
    }
    
    func createUploadsDirectory() throws {
        try app.createUploadsDirectory()
    }
    
    func filePath(for resource: MediaResource) -> String? {
        guard let fileName = resource.fileName else { return nil }
        return uploadPath(for: fileName)
    }
    
    func previewFilePath(for resource: MediaResource) -> String? {
        guard let fileName = resource.previewFileName else { return nil }
        return uploadPath(for: fileName)
    }
    
    func fileExists(for resource: MediaResource) -> Bool {
        guard let filePath = filePath(for: resource) else { return false }
        return FileManager.default.fileExists(atPath: filePath)
    }
    
    func previewExists(for resource: MediaResource) -> Bool {
        guard let filePath = previewFilePath(for: resource) else { return false }
        return FileManager.default.fileExists(atPath: filePath)
    }
    
    func removeFile(for resource: MediaResource) throws {
        guard let filePath = filePath(for: resource) else { return }
        try FileManager.default.removeItem(atPath: filePath)
    }
    
    func removePreview(for resource: MediaResource) throws {
        guard let filePath = previewFilePath(for: resource) else { return }
        try FileManager.default.removeItem(atPath: filePath)
    }
    
    func removeFiles(for resource: MediaResource) throws {
        try removeFile(for: resource)
        try removePreview(for: resource)
    }
}

// MARK: Database

extension CoreService {
    
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

// MARK: Constants

extension CoreService {
    
    static let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return df
    }()
    
    struct Constants {
        /// Registration constants
        static let minPasswordLength = 8
        static let maxPasswordLength = 25
        static let minUsernameLength = 5
        static let maxUsernameLength = 25
        static let minAccountKeyLength = 25
        static let maxAccountKeyLength = 100
    }
    
    struct Errors {
        /// Registration errors
        static let invalidUser       = ServiceError(.notFound, reason: "User was not found.")
        static let invalidPassword   = ServiceError(.forbidden, reason: "Invalid user or password.")
        static let invalidAccountKey = ServiceError(.forbidden, reason: "Invalid user or account key.")
        static let badPassword       = ServiceError(.badRequest, reason: "Password should be at least \(Constants.minPasswordLength) characters length.")
        static let badAccountKey     = ServiceError(.badRequest, reason: "Key should be at least \(Constants.minAccountKeyLength) characters length.")
        static let badName           = ServiceError(.badRequest, reason: "Name should consist of letters.")
        static let badUsername       = ServiceError(.badRequest, reason: "Username should be at least \(Constants.minUsernameLength) characters length, start with letter and consist of letters and digits.")
        
        /// Upload errors
        static let uploadTooLarge    = ServiceError(.payloadTooLarge, reason: "Your upload exeeded max limit of 50Mb.")
        
        /// Other
        static let idRequired        = ServiceError(.internalServerError, reason: "ID Required.")
    }
}
