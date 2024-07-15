import Foundation

protocol Notificator {
    func notify(chat: Chat, about event: Service.Event, from user: User?, with payload: JSON?) async throws
}

public final class NotificationManager: Notificator {
    
    private let wsSender: WebSocketSender
    private let pushSender: PushSender
    
    init(wsSender: WebSocketSender, pushSender: PushSender) {
        self.wsSender = wsSender
        self.pushSender = pushSender
    }
    
    func notify(chat: Chat, about event: Service.Event, from user: User?, with payload: JSON?) async throws {
        let relations = try await Service.shared.chats.repo.findRelations(of: chat.id!, isUserBlocked: false)
        let allowed = relations.filter { !$0.isChatBlocked }
        for relation in allowed {
            for session in relation.user.deviceSessions {
                let source = user == nil ? "system" : "\(user!.id ?? 0)"
                let notification = Service.Notification(event: event, source: source, payload: payload)
                let sent = try await wsSender.send(notification, to: session)
                if !sent {
                    if let device = session.deviceInfo, event == .message && !relation.isMuted {
                        await pushSender.send(notification, to: device)
                    }
                }
            }
        }
    }
}

extension DeviceSession {
    var deviceInfo: DeviceInfo? {
        guard let deviceToken = deviceToken, let transport = DeviceInfo.PushTransport(rawValue: pushTransport) else {
            return nil
        }
        return .init(id: deviceId, name: deviceName, model: deviceModel, token: deviceToken, transport: transport)
    }
}
