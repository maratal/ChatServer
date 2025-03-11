import Vapor
import WebSocketKit

protocol WebSocketProtocol: Sendable {
    func send(data: Data) async throws
    func sendPing() async throws
    func close()
    func onClose(_ closure: @Sendable @escaping (Error?) -> Void)
    var isClosed: Bool { get }
}

protocol WebSocketServer: Sendable {
    func accept(_ ws: WebSocketProtocol, clientAddress: String, for session: DeviceSession) async throws
}

protocol WebSocketSender: Sendable {
    func send(_ notification: CoreService.Notification, to session: DeviceSession) async throws -> Bool
}

actor WebSocketManager: WebSocketServer, WebSocketSender {
    
    private let core: CoreService
    private var clients = [String: WebSocketProtocol]()
    private let clientsQueue = DispatchQueue(label: "\(WebSocketManager.self).clientsQueue", attributes: .concurrent)
    
    init(core: CoreService) {
        self.core = core
    }
    
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
        guard let channel = session.id?.uuidString else { throw CoreService.Errors.idRequired }
        session.ipAddress = clientAddress
        try await core.saveItem(session)
        setClient(ws, for: channel)
        ws.onClose { [weak self] _ in
            guard let self else { return }
            Task {
                await self.setClient(nil, for: channel)
            }
        }
        try await ws.sendPing()
    }
    
    func send(_ notification: CoreService.Notification, to session: DeviceSession) async throws -> Bool {
        guard let channel = session.id?.uuidString else { throw CoreService.Errors.idRequired }
        guard let ws = getClient(channel) else {
            core.logger.info("Client at channel '\(channel)' was not connected.")
            return false
        }
        guard !ws.isClosed else {
            core.logger.info("Client at channel '\(channel)' was disconnected.")
            setClient(nil, for: channel)
            return false
        }
        do {
            try await ws.send(data: notification.jsonObject().data())
            core.logger.info("--- Message '\(notification.event)' sent to channel '\(channel)' with source '\(notification.source)' and data: \(String(describing: notification.payload))")
            return true
        } catch {
            core.logger.info("--- Message '\(notification.event)' send failed on channel '\(channel)': \(error)")
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
    
    func onClose(_ closure: @Sendable @escaping (Error?) -> Void) {
        onClose.whenComplete { result in
            switch result {
            case .failure(let error):
                closure(error)
            case .success:
                closure(nil)
            }
        }
    }
}
