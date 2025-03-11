import Foundation

protocol PushSender: Sendable {
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async
}

actor PushManager: PushSender {
    private let core: CoreService
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async {
        guard let deviceToken = device.token else {
            return core.logger.debug("Can't send push without device token.")
        }
        core.logger.info("'\(device.transport.rawValue.uppercased())' push '\(notification.event)' sent to device '\(deviceToken)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
    }
    
    init(core: CoreService, apnsKeyPath: String, fcmKeyPath: String) {
        self.core = core
    }
}
