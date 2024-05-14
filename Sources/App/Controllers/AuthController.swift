import Vapor

struct AuthController: AuthService, RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.post(use: register)
        users.post("resetPassword", use: resetPassword)
        
        let auth = users.grouped(User.authenticator())
        auth.post("login", use: login)
        
        let protected = users.grouped(UserToken.authenticator())
        protected.group("me") { route in
            route.get(use: me)
            route.put("changePassword", use: changePassword)
            route.put("setAccountKey", use: setAccountKey)
            route.post("logout", use: logout)
            route.delete(use: deregister)
        }
    }
    
    func register(req: Request) async throws -> LoginResponse {
        let content = try req.content.decode(RegistrationRequest.self)
        return try await register(content)
    }
    
    func deregister(req: Request) async throws -> HTTPStatus {
        try await deregister(try req.authenticatedUser())
        return .ok
    }
    
    func login(_ req: Request) async throws -> LoginResponse {
        try await login(try req.authenticatedUser())
    }
    
    func logout(_ req: Request) async throws -> HTTPStatus {
        try await logout(try req.authenticatedUser())
        req.auth.logout(User.self)
        return .ok
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
    
    func setAccountKey(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(SetAccountKeyRequest.self)
        try await setAccountKey(req.authenticatedUser(), currentPassword: content.password, newAccountKey: content.accountKey)
        return .ok
    }
}
