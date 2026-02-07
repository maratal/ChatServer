import Vapor
import Crypto

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
    private let apns: ApplePushSender?
    private let fcm: FirebasePushSender?
    private let web: WebPushSender?
    
    init(core: CoreService, app: Application) {
        self.core = core
        
        if let apnsKeyPath = Environment.get("APNS_KEY_PATH") {
            self.apns = ApplePushSender(core: core, apnsKeyPath: apnsKeyPath)
        } else {
            self.apns = nil
        }
        
        if let fcmKeyPath = Environment.get("FCM_KEY_PATH") {
            self.fcm = FirebasePushSender(core: core, fcmKeyPath: fcmKeyPath)
        } else {
            self.fcm = nil
        }
        
        if let vapidPrivateKey = Environment.get("VAPID_PRIVATE_KEY"),
           let vapidPublicKey = Environment.get("VAPID_PUBLIC_KEY"),
           let vapidSubject = Environment.get("VAPID_SUBJECT") {
            self.web = WebPushSender(
                core: core,
                app: app,
                vapidPrivateKey: vapidPrivateKey,
                vapidPublicKey: vapidPublicKey,
                vapidSubject: vapidSubject
            )
        } else {
            self.web = nil
        }
    }
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async {
        guard let _ = device.token else {
            return core.logger.debug("Can't send push without device token.")
        }
        switch device.transport {
        case .none:
            core.logger.info("Push transport is not set for device id = \(device.id)")
        case .apns:
            await apns?.send(notification, to: device)
        case .fcm:
            await fcm?.send(notification, to: device)
        case .web:
            await web?.send(notification, to: device)
        }
    }
}
