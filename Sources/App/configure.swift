import Fluent
import FluentPostgresDriver
import Vapor
import Leaf
import NIOSSL

func configure(_ app: Application, service: inout CoreService) throws {
    app.logger = Logger(label: "Default 👉")
    
    app.directory.viewsDirectory = app.directory.publicDirectory + "app/html"
    app.views.use(.leaf)
    
    // Configure TLS if certificate paths are provided
    if let certPath = Environment.get("TLS_CERT_PATH"),
       let keyPath = Environment.get("TLS_KEY_PATH") {
        let certs = try NIOSSLCertificate.fromPEMFile(certPath)
        let privateKey = try NIOSSLPrivateKey(file: keyPath, format: .pem)
        var tlsConfig = TLSConfiguration.makeServerConfiguration(
            certificateChain: certs.map { .certificate($0) },
            privateKey: .privateKey(privateKey)
        )
        tlsConfig.minimumTLSVersion = .tlsv12
        app.http.server.configuration.tlsConfiguration = tlsConfig
    }
    
    // Configure database - prefer DATABASE_URL for Heroku, fallback to individual env vars
    if let databaseURL = Environment.get("DATABASE_URL") {
        try app.databases.use(.postgres(url: databaseURL), as: .psql)
    } else {
        app.databases.use(DatabaseConfigurationFactory.postgres(configuration: .init(
            hostname: Environment.get("DATABASE_HOST") ?? "localhost",
            port: Environment.get("DATABASE_PORT").flatMap(Int.init(_:)) ?? SQLPostgresConfiguration.ianaPortNumber,
            username: Environment.get("DATABASE_USERNAME") ?? "postgres",
            password: Environment.get("DATABASE_PASSWORD"),
            database: Environment.get("DATABASE_NAME") ?? "postgres",
            tls: .disable)
        ), as: .psql)
    }

    app.migrations.add(CreateUser())
    app.migrations.add(CreateDeviceSession())
    app.migrations.add(CreateContact())
    app.migrations.add(CreateChat())
    app.migrations.add(CreateMessage())
    app.migrations.add(CreateChatToUser())
    app.migrations.add(CreateReaction())
    app.migrations.add(CreateMediaResource())
    app.migrations.add(CreateMessageToMedia())
    app.migrations.add(CreateNote())
    app.migrations.add(AddChatSettings())
    
    try app.createUploadsDirectory()
    
    try app.register(collection: UserController(service: service.users))
    try app.register(collection: ChatController(service: service.chats))
    try app.register(collection: ContactsController(service: service.contacts))
    try app.register(collection: MediaStorageController(service: service.mediaStorage))
    try app.register(collection: WebSocketController(core: service))
    try app.register(collection: UploadController())
    try app.register(collection: NotesController(service: service.notes, usersService: service.users))
    
    // Use custom FileMiddleware that only handles GET/HEAD requests
    app.middleware.use(ReadOnlyFileMiddleware(publicDirectory: app.directory.publicDirectory))

    routes(app)
}

/// FileMiddleware that only handles GET and HEAD requests
struct ReadOnlyFileMiddleware: AsyncMiddleware {
    let publicDirectory: String
    
    func respond(to request: Request, chainingTo next: AsyncResponder) async throws -> Response {
        // Only serve files for GET and HEAD requests
        guard request.method == .GET || request.method == .HEAD else {
            return try await next.respond(to: request)
        }
        
        // Use standard FileMiddleware for safe methods
        let fileMiddleware = FileMiddleware(publicDirectory: publicDirectory)
        return try await fileMiddleware.respond(to: request, chainingTo: next)
    }
}
