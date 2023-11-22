import Vapor

extension UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.post(use: register)
        users.group(Request.Parameter.id.pathComponent) { route in
            route.get(use: user)
        }
        
        let auth = routes.grouped(User.authenticator()).grouped(User.guardMiddleware())
        auth.post("login", use: login)
        
        let protected = users.grouped(UserToken.authenticator()).grouped(UserToken.guardMiddleware())
        protected.get(use: search)
        protected.group(Request.Parameter.id.pathComponent) { route in
            route.delete(use: delete)
            route.get(use: user)
        }
    }
    
    func register(req: Request) async throws -> User.LoginInfo {
        let info = try req.content.decode(User.Registration.self)
        return try await register(info)
    }
    
    func login(_ req: Request) async throws -> User.LoginInfo {
        let user = try req.currentUser()
        let token = try await login(user)
        return .init(info: try UserInfo(from: user), token: token)
    }
    
    func me(_ req: Request) async throws -> User.LoginInfo {
        return .init(info: try UserInfo(from: try req.currentUser()))
    }
    
    func delete(req: Request) async throws -> HTTPStatus {
        try await delete(req.objectID())
        return .noContent
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        let user = try await find(req.objectID())
        return try UserInfo(from: user)
    }
    
    func search(_ req: Request) async throws -> [UserInfo] {
        let results = try await search(req.searchString())
        return try results.map { try UserInfo(from: $0) }
    }
}

extension Request {
    
    enum Parameter: String {
        case id
        
        var pathComponent: PathComponent {
            ":\(self)"
        }
    }
    
    func objectID() throws -> Int {
        guard let id = parameters.get(Parameter.id.rawValue, as: Int.self) else {
            throw Abort(.badRequest)
        }
        return id
    }
    
    func objectUUID() throws -> UUID {
        guard let uuid = parameters.get(Parameter.id.rawValue, as: UUID.self) else {
            throw Abort(.badRequest)
        }
        return uuid
    }
    
    func searchString() throws -> String {
        guard let s: String = query["s"] else {
            throw Abort(.badRequest)
        }
        return s.lowercased().trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
    }
}

extension Request {
    
    func currentUser() throws -> User {
        try auth.require(User.self)
    }
}
