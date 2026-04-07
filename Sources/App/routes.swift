import Vapor

func routes(_ app: Application, settingsService: any SettingsServiceProtocol) {
    app.get { req async throws -> View in
        let registrationOpen = try await settingsService.isRegistrationOpen()
        return try await req.view.render("index", IndexContext(registrationOpen: registrationOpen))
    }
    
    app.get("main") { req async throws -> View in
        let message = try await settingsService.serverMessage()
        return try await req.view.render("main", MainContext(serverMessage: message))
    }
    
    app.get("login") { req async throws -> View in
        let registrationOpen = try await settingsService.isRegistrationOpen()
        return try await req.view.render("login", IndexContext(registrationOpen: registrationOpen))
    }
    
    app.get("register") { req async throws -> View in
        let registrationOpen = try await settingsService.isRegistrationOpen()
        return try await req.view.render("register", IndexContext(registrationOpen: registrationOpen))
    }

    app.get("api", "info") { req async throws in
        ProductInfo()
    }
    
    // /users/<id> - redirect to /users/<id>/notes
    app.get("users", ":id") { req async throws -> Response in
        let userId = try req.parameters.require("id")
        return req.redirect(to: "/users/\(userId)/notes", redirectType: .permanent)
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
