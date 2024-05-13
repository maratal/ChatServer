import Vapor

struct AuthController: AuthService, RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.post(use: register)
        
        let auth = routes.grouped(User.authenticator())
        auth.post("login", use: login)
        
        let protected = users.grouped(UserToken.authenticator())
        protected.group("me") { route in
            route.get(use: me)
            route.put("changePassword", use: changePassword)
        }
    }
    
    func register(req: Request) async throws -> LoginResponse {
        let content = try req.content.decode(RegistrationRequest.self)
        return try await register(content)
    }
    
    func login(_ req: Request) async throws -> LoginResponse {
        try await login(try req.authenticatedUser())
    }
    
    func me(_ req: Request) async throws -> UserInfo {
        try req.authenticatedUser().fullInfo()
    }
    
    func changePassword(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(ChangePasswordRequest.self)
        try await changePassword(req.authenticatedUser(), currentPassword: content.oldPassword, newPassword: content.newPassword)
        return .ok
    }
    
    func resetPassword(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(ResetPasswordRequest.self)
        try await resetPassword(userId: content.userId, newPassword: content.newPassword, accountKey: content.accountKey)
        return .ok
    }
    
    func changeAccountKey(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(ChangeAccountKeyRequest.self)
        try await changeAccountKey(req.authenticatedUser(), password: content.password, newAccountKey: content.accountKey)
        return .ok
    }
}
