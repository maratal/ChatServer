import Fluent
import FluentPostgresDriver
import Vapor

func configure(_ app: Application, service: inout CoreService) throws {
    app.middleware.use(FileMiddleware(publicDirectory: app.directory.publicDirectory))

    app.databases.use(DatabaseConfigurationFactory.postgres(configuration: .init(
        hostname: Environment.get("DATABASE_HOST") ?? "localhost",
        port: Environment.get("DATABASE_PORT").flatMap(Int.init(_:)) ?? SQLPostgresConfiguration.ianaPortNumber,
        username: Environment.get("DATABASE_USERNAME") ?? "postgres",
        password: Environment.get("DATABASE_PASSWORD"),
        database: Environment.get("DATABASE_NAME") ?? "postgres",
        tls: .prefer(try .init(configuration: .clientDefault)))
    ), as: .psql)

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
    try app.register(collection: WebSocketController(server: service.wsServer))
    try app.register(collection: UploadController())
    
    try routes(app)
}
