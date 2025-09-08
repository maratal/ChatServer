import Vapor
import Fluent

extension DeviceSession: ModelTokenAuthenticatable {
    typealias User = App.User
    
    static var valueKey: KeyPath<DeviceSession, Field<String>> {
        \DeviceSession.$accessToken
    }
    
    static var userKey: KeyPath<DeviceSession, Parent<User>> {
        \DeviceSession.$user
    }
    
    var isValid: Bool {
        true
    }
}

extension DeviceSession {
    struct URLAccessTokenAuthenticator: RequestAuthenticator {
        func authenticate(request: Request) -> EventLoopFuture<Void> {
            return self.authenticate(accessToken: try? request.urlAccessToken(), for: request)
        }
        
        func authenticate(accessToken: String?, for request: Request) -> EventLoopFuture<Void> {
            do {
                return try DeviceSession.query(on: request.db)
                    .filter(\.$id == request.objectUUID())
                    .first()
                    .flatMap
                { session -> EventLoopFuture<Void> in
                    guard let session, accessToken?.lowercased() == session.accessToken.lowercased() else {
                        return request.eventLoop.makeSucceededFuture(())
                    }
                    request.auth.login(session)
                    return session.$user.get(on: request.db).map {
                        request.auth.login($0)
                    }
                }
            } catch {
                return request.eventLoop.makeSucceededFuture(())
            }
        }
    }
    
    static func urlAuthenticator() -> any Authenticator {
        URLAccessTokenAuthenticator()
    }
}
