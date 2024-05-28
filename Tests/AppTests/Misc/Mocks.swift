@testable import App

final class TestPushManager: PushSender {
    
    func send(_ notification: Service.Notification, to device: DeviceInfo) {
        guard let deviceToken = device.token else { return print("Can't send push without device token.") }
        print("--- TEST '\(device.transport.rawValue.uppercased())' push '\(notification.event)' sent to device '\(deviceToken)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
    }
}

final class TestWebSocketServer: WebSocketListener, WebSocketSender {
    
    func listenForDeviceWithSession(_ session: DeviceSession) throws {
        //
    }
    
    func send(_ notification: Service.Notification, to session: DeviceSession) async throws -> Bool {
        guard let channel = session.id?.uuidString else { throw ServiceError(.internalServerError) }
        print("--- Test Message '\(notification.event)' sent to channel '\(channel)' with source '\(notification.source)' and data: \(String(describing: notification.payload))")
        return true
    }
}

extension Service {
    
    static func configureTesting() {
        let server = TestWebSocketServer()
        Service.configure(listener: server,
                          notificator: NotificationManager(wsSender: server, pushSender: TestPushManager()))
    }
}
