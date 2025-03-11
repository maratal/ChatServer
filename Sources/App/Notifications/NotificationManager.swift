import Foundation

protocol Notificator: Sendable {
    func notify(chat: Chat, in repo: ChatsRepository, about event: CoreService.Event, from user: User?, with payload: JSON?) async throws
}

actor NotificationManager: Notificator {
    let webSocket: WebSocketSender
    let push: PushSender
    
    init(webSocket: WebSocketSender, push: PushSender) {
        self.webSocket = webSocket
        self.push = push
    }
    
    func notify(chat: Chat, in repo: ChatsRepository, about event: CoreService.Event, from user: User?, with payload: JSON?) async throws {
        let relations = try await repo.findRelations(of: chat.id!, isUserBlocked: false)
        let allowed = relations.filter { !$0.isChatBlocked }
        for relation in allowed {
            for session in relation.user.deviceSessions {
                let source = user == nil ? "system" : "\(user!.id ?? 0)"
                let notification = CoreService.Notification(event: event, source: source, payload: payload)
                let sent = try await webSocket.send(notification, to: session)
                if !sent {
                    if let device = session.deviceInfo, event == .message && !relation.isMuted {
                        await push.send(notification, to: device)
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
