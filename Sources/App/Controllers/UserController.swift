import Vapor

struct UserController: RouteCollection {
    
    func boot(routes: RoutesBuilder) throws {
        let users = routes.grouped("users")
        users.post(use: register)
        users.post("resetPassword", use: resetPassword)
        
        users.group(.id) { route in
            route.get(use: user)
        }
        
        let auth = users.grouped(User.authenticator())
        auth.post("login", use: login)
        
        let protected = users.grouped(DeviceSession.authenticator())
        protected.group("me") { route in
            route.get(use: current)
            route.put("changePassword", use: changePassword)
            route.put("setAccountKey", use: setAccountKey)
            route.post("logout", use: logout)
            route.delete(use: deregister)
            route.put(use: update)
            route.put("online", use: online)
            route.post("photos", use: addPhoto)
            route.delete("photos", .id, use: deletePhoto)
        }
        
        protected.get(use: search)
    }
    
    func register(req: Request) async throws -> User.PrivateInfo {
        let content = try req.content.decode(RegistrationRequest.self)
        return try await Service.users.register(content)
    }
    
    func deregister(req: Request) async throws -> HTTPStatus {
        try await Service.users.deregister(try req.authenticatedUser())
        return .ok
    }
    
    func login(_ req: Request) async throws -> User.PrivateInfo {
        let deviceInfo = try req.content.decode(DeviceInfo.self)
        return try await Service.users.login(try req.authenticatedUser(), deviceInfo: deviceInfo)
    }
    
    func logout(_ req: Request) async throws -> HTTPStatus {
        try await Service.users.logout(try req.authenticatedUser())
        req.auth.logout(User.self)
        return .ok
    }
    
    func current(_ req: Request) async throws -> User.PrivateInfo {
        try await Service.users.current(req.authenticatedUser())
    }
    
    func changePassword(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(ChangePasswordRequest.self)
        try await Service.users.changePassword(req.authenticatedUser(), currentPassword: content.oldPassword, newPassword: content.newPassword)
        return .ok
    }
    
    func resetPassword(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(ResetPasswordRequest.self)
        try await Service.users.resetPassword(userId: content.userId, newPassword: content.newPassword, accountKey: content.accountKey)
        return .ok
    }
    
    func setAccountKey(_ req: Request) async throws -> HTTPStatus {
        let content = try req.content.decode(SetAccountKeyRequest.self)
        try await Service.users.setAccountKey(req.authenticatedUser(), currentPassword: content.password, newAccountKey: content.accountKey)
        return .ok
    }
    
    func online(_ req: Request) async throws -> User.PrivateInfo {
        let deviceInfo = try req.content.decode(DeviceInfo.self)
        return try await Service.users.online(req.deviceSession(), deviceInfo: deviceInfo)
    }
    
    func update(_ req: Request) async throws -> UserInfo {
        try await Service.users.update(req.currentUser(), with: req.content.decode(UpdateUserRequest.self))
    }
    
    func addPhoto(_ req: Request) async throws -> UserInfo {
        try await Service.users.addPhoto(req.currentUser(), with: req.content.decode(UpdateUserRequest.self))
    }
    
    func deletePhoto(_ req: Request) async throws -> HTTPStatus {
        try await Service.users.deletePhoto(req.objectUUID(), of: req.currentUser())
        return .ok
    }
    
    func user(_ req: Request) async throws -> UserInfo {
        try await Service.users.find(id: req.objectID())
    }
    
    func search(_ req: Request) async throws -> [UserInfo] {
        try await Service.users.search(req.searchString())
    }
}
