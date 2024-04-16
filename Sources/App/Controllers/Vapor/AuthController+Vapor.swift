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
    }
    
    func register(req: Request) async throws -> User.LoginInfo {
        try await register(try req.content.decode(User.Registration.self))
    }
    
    func login(_ req: Request) async throws -> User.LoginInfo {
        try await login(try req.currentUser())
    }
    
    func me(_ req: Request) async throws -> UserInfo {
        try req.currentUser().info()
    }
}
