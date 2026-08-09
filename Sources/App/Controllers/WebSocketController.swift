import Vapor
import FluentKit
import NIOCore

struct WebSocketController: RouteCollection {

    let core: CoreService
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes
            .grouped(DeviceSession.urlAuthenticator()) // used by browser
            .grouped(DeviceSession.authenticator()) // used by tests
        
        protected.webSocket("ws", .id) { req, socket in
            // Without a heartbeat a client that goes away without closing —
            // a killed tab, a slept laptop, a dropped network — leaves the
            // channel open indefinitely: TCP alone will not notice for hours,
            // so the session stays listed as connected and notifications are
            // sent into a socket nobody is reading. A ping with no pong before
            // the next one closes the channel, which is what fires onClose.
            socket.pingInterval = .seconds(30)

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
