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
        try await changePassword(req.authenticatedUser(), oldPassword: content.oldPassword, newPassword: content.newPassword)
        return .ok
    }
    
    func resetPassword(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(ResetPasswordRequest.self)
        try await resetPassword(userId: content.userId, newPassword: content.newPassword, key: content.key)
        return .ok
    }
    
    func changeKey(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(ChangeKeyRequest.self)
        try await changeKey(req.authenticatedUser(), password: content.password, newKey: content.newKey)
        return .ok
    }
}

extension AuthController {
    
    struct RegistrationRequest: Content {
        var name: String
        var username: String
        var password: String
    }
    
    struct LoginResponse: Content {
        var info: UserInfo
        var token: String
    }
    
    struct ChangePasswordRequest: Content {
        var oldPassword: String
        var newPassword: String
    }
    
    struct ResetPasswordRequest: Content {
        var userId: Int
        var newPassword: String
        var key: String
    }
    
    struct ChangeKeyRequest: Content {
        var password: String
        var newKey: String
    }
}
