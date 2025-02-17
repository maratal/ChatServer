import Foundation

protocol PushSender: Sendable {
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async
}

actor PushManager: PushSender {
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async {
        guard let deviceToken = device.token else { return print("Can't send push without device token.") }
        print("'\(device.transport.rawValue.uppercased())' push '\(notification.event)' sent to device '\(deviceToken)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
    }
    
    init(apnsKeyPath: String, fcmKeyPath: String) {
        //
    }
}
