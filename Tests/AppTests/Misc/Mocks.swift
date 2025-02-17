@testable import App
import XCTVapor

final class TestPushManager: PushSender {
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) {
        guard let deviceToken = device.token else { return print("Can't send push without device token.") }
        print("--- TEST '\(device.transport.rawValue.uppercased())' push '\(notification.event)' sent to device '\(deviceToken)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
    }
}

final class TestWebSocketManager: WebSocketServer, WebSocketSender {
    
    func accept(_ ws: App.WebSocketProtocol, clientAddress: String, for session: App.DeviceSession) async throws {
        print("Accepted client at address \(clientAddress)")
    }
    
    func send(_ notification: CoreService.Notification, to session: DeviceSession) async throws -> Bool {
        guard let channel = session.id?.uuidString else { throw ServiceError(.internalServerError) }
        print("--- Test Message '\(notification.event)' sent to channel '\(channel)' with source '\(notification.source)' and data: \(String(describing: notification.payload))")
        return true
    }
}

actor TestNotificationManager: Notificator {
    
    private var sentNotifications = [CoreService.Notification]()
    
    func getSentNotifications() -> [CoreService.Notification] {
        sentNotifications
    }
    
    func clearSentNotifications() {
        sentNotifications.removeAll()
    }
    
    func notify(chat: Chat, in repo: ChatsRepository, about event: CoreService.Event, from user: User?, with payload: JSON?) async throws {
        let source = user == nil ? "system" : "\(user!.id ?? 0)"
        var notification = CoreService.Notification(event: event, source: source, payload: payload)
        let relations = try await repo.findRelations(of: chat.id!, isUserBlocked: false)
        let allowed = relations.filter { !$0.isChatBlocked }
        for relation in allowed {
            notification.destination = "\(relation.user.id!)"
            print("--- TEST notification '\(notification.event)' sent to '\(relation.user.username)' of chat '\(chat.id!)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
            sentNotifications.append(notification)
        }
    }
}

extension CoreService {
    
    var testNotificator: TestNotificationManager {
        notificator as! TestNotificationManager
    }
}
