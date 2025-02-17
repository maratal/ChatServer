import Vapor

func routes(_ app: Application) throws {
    app.get { req async in
        "Demo Server v1.0"
    }
}
