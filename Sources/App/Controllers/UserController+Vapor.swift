import Vapor

typealias ServerError = Abort

extension UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.get(use: index)
        users.post(use: create)
        users.group(":userID") { user in
            user.delete(use: delete)
        }
    }

    func index(req: Request) async throws -> [User] {
        try await all()
    }

    func create(req: Request) async throws -> User {
        let user = try req.content.decode(User.self)
        return try await create(user)
    }

    func delete(req: Request) async throws -> HTTPStatus {
        try await delete(req.userID())
        return .noContent
    }
}

extension Request {
    
    func userID() throws -> Int {
        guard let id = Int(parameters.get("userID") ?? "") else {
            throw Abort(.badRequest)
        }
        return id
    }
}
