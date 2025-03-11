import Vapor

struct WebSocketController: RouteCollection {

    let core: CoreService
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped(DeviceSession.authenticator())
        protected.webSocket(.id) { req, socket in
            do {
                try await core.wsServer.accept(socket, clientAddress: req.peerAddress?.ipAddress ?? "::0", for: req.deviceSession())
            }
            catch {
                core.logger.error("Error accepting user's web socket: \(error)")
            }
        }
    }
}
