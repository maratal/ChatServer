import NIOSSL
import Fluent
import FluentPostgresDriver
import Vapor

// configures your application
public func configure(_ app: Application) throws {
    Application.itself = app
    
    // uncomment to serve files from /Public folder
    // app.middleware.use(FileMiddleware(publicDirectory: app.directory.publicDirectory))

    app.databases.use(DatabaseConfigurationFactory.postgres(configuration: .init(
        hostname: Environment.get("DATABASE_HOST") ?? "localhost",
        port: Environment.get("DATABASE_PORT").flatMap(Int.init(_:)) ?? SQLPostgresConfiguration.ianaPortNumber,
        username: Environment.get("DATABASE_USERNAME") ?? "postgres",
        password: Environment.get("DATABASE_PASSWORD"),
        database: Environment.get("DATABASE_NAME") ?? "postgres",
        tls: .prefer(try .init(configuration: .clientDefault)))
    ), as: .psql)

    app.migrations.add(CreateUser())
    app.migrations.add(CreateUserToken())
    app.migrations.add(CreateContact())
    app.migrations.add(CreateChat())
    app.migrations.add(CreateMessage())
    app.migrations.add(CreateChatToUser())
    app.migrations.add(CreateReaction())

    Repositories.useDatabase()
    
    try app.autoMigrate().wait()
    
    // register routes
    try routes(app)
}
