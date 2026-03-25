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
    
    // /<username> or /<user_id> - redirect to /users/<id>/notes
    app.get(":username") { req async throws -> Response in
        let username = try req.parameters.require("username")

        // Numeric - treat as user ID directly
        if let userId = Int(username) {
            return req.redirect(to: "/users/\(userId)/notes", redirectType: .permanent)
        }

        // Non-numeric - look up user by username (case-insensitive)
        guard let user = try await User.query(on: req.db)
            .filter(.string("username"), .custom("ILIKE"), username)
            .first()
        else {
            throw Abort(.notFound, reason: "User '\(username)' not found.")
        }

        guard let userId = user.id else {
            throw Abort(.internalServerError)
        }

        return req.redirect(to: "/users/\(userId)/notes", redirectType: .permanent)
    }
}
