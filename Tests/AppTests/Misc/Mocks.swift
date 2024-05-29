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

final class TestNotificationManager: Notificator {
    
    var sentNotifications = [Service.Notification]()
    
    func notify(chat: Chat, with info: Encodable? = nil, about event: Service.Event, from user: User?) async throws {
        let source = user == nil ? "system" : "\(user!.id ?? 0)"
        let notification = Service.Notification(event: event, source: source, payload: info)
        print("--- TEST notification '\(notification.event)' sent to chat '\(chat.id!)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
        sentNotifications.append(notification)
    }
}

extension Service {
    
    static func configureTesting() {
        Service.configure(listener: TestWebSocketServer(), notificator: TestNotificationManager())
    }
    
    static var testNotificator: TestNotificationManager {
        notificator as! TestNotificationManager
    }
}
