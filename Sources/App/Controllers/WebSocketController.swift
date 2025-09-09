import Vapor
import FluentKit

struct WebSocketController: RouteCollection {

    let core: CoreService
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes
            .grouped(DeviceSession.urlAuthenticator()) // used by browser
            .grouped(DeviceSession.authenticator()) // used by tests
        
        protected.webSocket(.id) { req, socket in
            let address = req.peerAddress?.ipAddress ?? "::0"
            do {
                let deviceSession = try req.deviceSession()
                try await core.wsServer.accept(socket, clientAddress: address, for: deviceSession)
                let sessionID = try deviceSession.requireID()
                core.logger.info("Accepted user's web socket session \(sessionID) with address '\(address)'")
            }
            catch {
                core.logger.warning("Error accepting user's web socket with address '\(address)': \(error)")
            }
        }
    }
}
