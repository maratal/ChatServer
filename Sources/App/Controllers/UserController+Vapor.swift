import Vapor

typealias ServerError = Abort

extension UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.get(use: index)
        users.post(use: create)
        users.group(":id") { route in
            route.delete(use: delete)
            route.get(use: user)
        }
    }
    
    func me(_ req: Request) async throws -> UserInfo {
        try UserInfo(from: req.currentUser())
    }
    
    func index(req: Request) async throws -> [UserInfo] {
        try await all().map { try UserInfo(from: $0) }
    }

    func create(req: Request) async throws -> UserInfo {
        let user = try req.content.decode(User.self)
        try await create(user)
        return try UserInfo(from: user)
    }

    func delete(req: Request) async throws -> HTTPStatus {
        try await delete(req.objectID())
        return .noContent
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        let user = try await find(try req.objectID())
        return try UserInfo(from: user)
    }
}

extension Request {
    
    func objectID() throws -> Int {
        guard let id = Int(parameters.get("id") ?? "") else {
            throw Abort(.badRequest)
        }
        return id
    }
}

extension Request {
    
    func currentUser() throws -> User {
        try auth.require(User.self)
    }
}
