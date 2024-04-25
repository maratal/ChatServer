import Fluent
import Vapor

func routes(_ app: Application) throws {
    app.get { req async in
        "Demo Server v1.0"
    }

    try app.register(collection: AuthController())
    try app.register(collection: UserController())
    try app.register(collection: ChatController())
}
