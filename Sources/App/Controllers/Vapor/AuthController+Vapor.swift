import Vapor

extension AuthController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.post(use: register)
        
        let auth = routes.grouped(User.authenticator())
        auth.post("login", use: login)
        
        let protected = users.grouped(UserToken.authenticator())
        protected.group("me") { route in
            route.get(use: me)
        }
        protected.group("current") { route in
            route.get(use: currentUser)
        }
    }
    
    func register(req: Request) async throws -> User.LoginInfo {
        try await register(try req.content.decode(User.Registration.self))
    }
    
    func login(_ req: Request) async throws -> User.LoginInfo {
        try await login(try req.authenticatedUser())
    }
    
    func me(_ req: Request) async throws -> UserInfo {
        try req.authenticatedUser().info()
    }
    
    /// In test environment returns not real user for tests purposes only. In production is the same as `me`.
    func currentUser(_ req: Request) async throws -> UserInfo {
        try await req.currentUser().info()
    }
}
