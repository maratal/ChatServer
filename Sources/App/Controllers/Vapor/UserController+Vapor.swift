import Vapor

extension UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.group(Request.Parameter.id.pathComponent) { route in
            route.get(use: user)
        }
        
        let protected = users.grouped(UserToken.authenticator())
        protected.get(use: search)
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        try await user(req.objectID())
    }
    
    func search(_ req: Request) async throws -> [UserInfo] {
        try await search(req.searchString())
    }
}
