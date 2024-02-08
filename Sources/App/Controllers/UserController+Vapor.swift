import Vapor

extension UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.post(use: register)
        users.group(Request.Parameter.id.pathComponent) { route in
            route.get(use: user)
        }
        
        let auth = routes.grouped(User.authenticator())
        auth.post("login", use: login)
        
        let protected = users.grouped(UserToken.authenticator())
        protected.get(use: search)
        protected.group(Request.Parameter.id.pathComponent) { route in
            route.delete(use: delete)
//            route.get(use: user)
        }
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
    
    func delete(req: Request) async throws -> HTTPStatus {
        try await delete(req.objectID())
        return .ok
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        try await user(req.objectID())
    }
    
    func search(_ req: Request) async throws -> [UserInfo] {
        try await search(req.searchString())
    }
}
