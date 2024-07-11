import Vapor
import WebSocketKit

protocol WebSocketListener {
    func listenForDeviceWithSession(_ session: DeviceSession) throws
}

protocol WebSocketSender {
    func send(_ notification: Service.Notification, to session: DeviceSession) async throws -> Bool
}

final class WebSocketServer: WebSocketListener, WebSocketSender {
    
    private var clients = [String: WebSocket]()
    
    private let clientsQueue = DispatchQueue(label: "\(WebSocketServer.self).clientsQueue", attributes: .concurrent)
    
    private func setClient(_ ws: WebSocket?, for channel: String) {
        clientsQueue.sync(flags: .barrier) {
            if let oldClient = clients[channel] {
                _ = oldClient.close(code: .normalClosure)
            }
            clients[channel] = ws
        }
    }
    
    private func getClient(_ channel: String) -> WebSocket? {
        var ws: WebSocket? = nil
        clientsQueue.sync(flags: .barrier) {
            ws = clients[channel]
        }
        return ws
    }
    
    func listenForDeviceWithSession(_ session: DeviceSession) throws {
        guard let channel = session.id?.uuidString else { throw Service.Errors.idRequired }
        setClient(nil, for: channel)
        Application.shared.webSocket("\(channel)") { [weak self] req, ws in
            self?.setClient(ws, for: channel)
            ws.onClose.whenComplete { result in
                self?.setClient(nil, for: channel)
            }
        }
    }
    
    func send(_ notification: Service.Notification, to session: DeviceSession) async throws -> Bool {
        guard let channel = session.id?.uuidString else { throw Service.Errors.idRequired }
        guard let ws = getClient(channel) else {
            print("Client at channel '\(channel)' was not connected.")
            return false
        }
        guard !ws.isClosed else {
            print("Client at channel '\(channel)' was disconnected.")
            setClient(nil, for: channel)
            return false
        }
        do {
            try await ws.send(raw: notification.jsonObject().data(), opcode: .binary)
            print("--- Message '\(notification.event)' sent to channel '\(channel)' with source '\(notification.source)' and data: \(String(describing: notification.payload))")
            return true
        } catch {
            print("--- Message '\(notification.event)' send failed on channel '\(channel)': \(error)")
            return false
        }
    }
}
