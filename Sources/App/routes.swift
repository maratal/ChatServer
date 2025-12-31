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
    
    // Serve files from Public directory under /files/ path
    app.get("files", "**") { req async throws -> Response in
        // Extract the file path after /files/
        let catchall = req.parameters.getCatchall()
        let filePath = catchall.joined(separator: "/")
        let publicDir = req.application.directory.publicDirectory
        let fullPath = publicDir + filePath
        
        // Check if file exists
        guard FileManager.default.fileExists(atPath: fullPath) else {
            throw Abort(.notFound)
        }
        
        // Serve the file
        return try await req.fileio.asyncStreamFile(at: fullPath)
    }
}
