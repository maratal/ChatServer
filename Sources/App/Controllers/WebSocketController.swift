import Vapor

struct WebSocketController: RouteCollection {
    
    var server: WebSocketServer { Service.shared.wsServer }
    
    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped(DeviceSession.authenticator())
        protected.webSocket(.id) { req, socket in
            do {
                try await server.accept(socket, clientAddress: req.peerAddress?.ipAddress ?? "::0", for: req.deviceSession())
            }
            catch {
                print("Error accepting user's web socket: \(error)")
            }
        }
    }
}
