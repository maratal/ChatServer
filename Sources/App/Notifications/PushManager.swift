import Foundation

protocol PushSender: Sendable {
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async
}

actor FirebasePushSender: PushSender {
    private let core: CoreService
    
    init(core: CoreService, fcmKeyPath: String) {
        self.core = core
    }
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async {
        guard let deviceToken = device.token, device.transport == .fcm else {
            preconditionFailure("Can't send FCM push without device token.")
        }
        core.logger.info("'\(device.transport.rawValue.uppercased())' push '\(notification.event)' sent to FCM device '\(deviceToken)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
    }
}

actor ApplePushSender: PushSender {
    private let core: CoreService
    
    init(core: CoreService, apnsKeyPath: String) {
        self.core = core
    }
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async {
        guard let deviceToken = device.token, device.transport == .apns else {
            preconditionFailure("Can't send iOS push without device token.")
        }
        core.logger.info("'\(device.transport.rawValue.uppercased())' push '\(notification.event)' sent to iOS device '\(deviceToken)' with source '\(notification.source)' and payload: \(String(describing: notification.payload))")
    }
}

actor PushManager: PushSender {
    private let core: CoreService
    private let apns: ApplePushSender
    private let fcm: FirebasePushSender
    
    init(core: CoreService, apnsKeyPath: String, fcmKeyPath: String) {
        self.core = core
        self.apns = ApplePushSender(core: core, apnsKeyPath: fcmKeyPath)
        self.fcm = FirebasePushSender(core: core, fcmKeyPath: apnsKeyPath)
    }
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async {
        guard let deviceToken = device.token else {
            return core.logger.debug("Can't send push without device token.")
        }
        switch device.transport {
        case .none:
            core.logger.info("Push transport is not set, skipping push to device with token = \(deviceToken)")
        case .apns:
            await apns.send(notification, to: device)
        case .fcm:
            await fcm.send(notification, to: device)
        case .web:
            core.logger.info("Web push transport is not supported yet, skipping push to device with token = \(deviceToken)")
        }
    }
}
