import Vapor

func routes(_ app: Application) {
    app.get { req async throws -> View in
        try await req.view.render("index", ProductInfo())
    }
    
    app.get("main") { req async throws -> View in
        try await req.view.render("main", ProductInfo())
    }
    
    app.get("login") { req async throws -> View in
        try await req.view.render("login", ProductInfo())
    }
    
    app.get("register") { req async throws -> View in
        try await req.view.render("register", ProductInfo())
    }
}
