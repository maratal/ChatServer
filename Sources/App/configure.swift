import Fluent
import FluentPostgresDriver
import Vapor
import Leaf

func configure(_ app: Application, service: inout CoreService) throws {
    app.logger = Logger(label: "Default 👉")
    
    app.middleware.use(FileMiddleware(publicDirectory: app.directory.publicDirectory))
    
    app.directory.viewsDirectory = app.directory.publicDirectory + "app/html"
    app.views.use(.leaf)
    
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
            tls: .prefer(try .init(configuration: .clientDefault)))
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
    
    try app.createUploadsDirectory()
    
    try app.register(collection: UserController(service: service.users))
    try app.register(collection: ChatController(service: service.chats))
    try app.register(collection: ContactsController(service: service.contacts))
    try app.register(collection: WebSocketController(core: service))
    try app.register(collection: UploadController())
    
    routes(app)
}
