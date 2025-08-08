import Vapor

func routes(_ app: Application) {
    app.get { req async throws -> View in
        try await req.view.render("home", ProductInfo())
    }
}
