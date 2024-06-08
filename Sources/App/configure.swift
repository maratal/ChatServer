import NIOSSL
import Fluent
import FluentPostgresDriver
import Vapor

// configures your application
public func configure(_ app: Application) throws {
    Application.shared = app
    
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
    
    try app.autoMigrate().wait()
    
    try app.createUploadsDirectory()
    
    let wsServer = WebSocketServer()
    let pushes = PushManager(apnsKeyPath: "", fcmKeyPath: "")
    
    Service.configure(database: app.db,
                      listener: wsServer,
                      notificator: NotificationManager(wsSender: wsServer, pushSender: pushes))
    
    // register routes
    try routes(app)
}
