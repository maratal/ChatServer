import Fluent
import Foundation

final class DeviceSession: RepositoryItem {
    static let schema = "device_sessions"

    @ID(key: .id)
    var id: UUID?
    
    @Field(key: "access_token")
    var accessToken: String
    
    @Field(key: "device_id")
    var deviceId: UUID
    
    @Field(key: "device_name")
    var deviceName: String
    
    @Field(key: "device_model")
    var deviceModel: String
    
    @Field(key: "device_token")
    var deviceToken: String?
    
    @Field(key: "push_transport")
    var pushTransport: String
    
    @Parent(key: "user_id")
    var user: User
    
    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?
    
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?
    
    init() { }

    init(id: UUID? = nil, accessToken: String, userID: UserID, deviceId: UUID, deviceName: String, deviceModel: String, deviceToken: String?, pushTransport: String) {
        self.id = id
        self.accessToken = accessToken
        self.$user.id = userID
        self.deviceId = deviceId
        self.deviceName = deviceName
        self.deviceModel = deviceModel
        self.deviceToken = deviceToken
        self.pushTransport = pushTransport
    }
}

extension DeviceSession {
    
    struct Info: Serializable {
        var id: UUID
        var accessToken: String
        var deviceInfo: DeviceInfo
        var createdAt: Date?
        var updatedAt: Date?

        init(from session: DeviceSession) {
            self.id = session.id!
            self.accessToken = session.accessToken
            self.createdAt = session.createdAt
            self.updatedAt = session.updatedAt
            self.deviceInfo = DeviceInfo(id: session.deviceId,
                                         name: session.deviceName,
                                         model: session.deviceModel,
                                         token: session.deviceToken,
                                         transport: DeviceInfo.PushTransport(rawValue: session.pushTransport) ?? .none)
        }
    }
    
    func info() -> Info {
        Info(from: self)
    }
}

struct DeviceInfo: Serializable {
    enum PushTransport: String, Codable {
        case none, apns, fcm, web
    }
    var id: UUID
    var name: String
    var model: String
    var token: String?
    var transport: PushTransport
}
