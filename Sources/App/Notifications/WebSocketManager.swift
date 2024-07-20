import Vapor
import WebSocketKit

protocol WebSocketServer {
    func accept(_ ws: WebSocketProtocol, clientAddress: String, for session: DeviceSession) async throws
}

protocol WebSocketSender {
    func send(_ notification: Service.Notification, to session: DeviceSession) async throws -> Bool
}

final class WebSocketManager: WebSocketServer, WebSocketSender {
    
    private var clients = [String: WebSocketProtocol]()
    
    private let clientsQueue = DispatchQueue(label: "\(WebSocketManager.self).clientsQueue", attributes: .concurrent)
    
    private func setClient(_ ws: WebSocketProtocol?, for channel: String) {
        clientsQueue.sync(flags: .barrier) {
            if let oldClient = clients[channel] {
                _ = oldClient.close()
            }
            clients[channel] = ws
        }
    }
    
    private func getClient(_ channel: String) -> WebSocketProtocol? {
        var ws: WebSocketProtocol? = nil
        clientsQueue.sync(flags: .barrier) {
            ws = clients[channel]
        }
        return ws
    }
    
    func accept(_ ws: WebSocketProtocol, clientAddress: String, for session: DeviceSession) async throws {
        guard let channel = session.id?.uuidString else { throw Service.Errors.idRequired }
        session.ipAddress = clientAddress
        try await Service.shared.saveItem(session)
        setClient(ws, for: channel)
        ws.onClose { [weak self] _ in
            self?.setClient(nil, for: channel)
        }
        try await ws.sendPing()
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
            try await ws.send(data: notification.jsonObject().data())
            print("--- Message '\(notification.event)' sent to channel '\(channel)' with source '\(notification.source)' and data: \(String(describing: notification.payload))")
            return true
        } catch {
            print("--- Message '\(notification.event)' send failed on channel '\(channel)': \(error)")
            return false
        }
    }
}

extension WebSocket: WebSocketProtocol {
    
    func send(data: Data) async throws {
        try await send(raw: data, opcode: .binary)
    }
    
    func sendPing() async throws {
        try await sendPing(Data())
    }
    
    func close() {
        _ = close(code: .normalClosure)
    }
    
    func onClose(_ closure: @escaping (Result<Void, Error>) -> Void) {
        onClose.whenComplete { result in
            closure(result)
        }
    }
}
