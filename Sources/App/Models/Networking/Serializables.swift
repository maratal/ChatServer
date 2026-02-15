import Foundation

struct RegistrationRequest: Serializable {
    var name: String
    var username: String
    var password: String
    var deviceInfo: DeviceInfo
}

struct ChangePasswordRequest: Serializable {
    var currentPassword: String
    var newPassword: String
}

struct ResetPasswordRequest: Serializable {
    var userId: Int
    var newPassword: String
    var accountKey: String
}

struct SetAccountKeyRequest: Serializable {
    var password: String
    var accountKey: String
}

struct CreateChatRequest: Serializable {
    var title: String?
    var participants: [UserID]
    var isPersonal: Bool?
}

struct UpdateUserRequest: Serializable {
    var name: String?
    var about: String?
    var photo: MediaInfo?
}

struct UpdateDeviceSessionRequest: Serializable {
    var deviceName: String
    var deviceToken: String?
}

struct UpdateChatRequest: Serializable {
    var title: String?
    var isMuted: Bool?
    var isArchived: Bool?
    var isBlocked: Bool?
    var isRemovedOnDevice: Bool?
    var image: MediaInfo?
}

struct UpdateChatUsersRequest: Serializable {
    var users: [UserID]
}

struct PostMessageRequest: Serializable {
    var localId: String?
    var text: String?
    var isVisible: Bool?
    var replyTo: MessageID?
    var attachments: [MediaInfo]?
}

struct UpdateMessageRequest: Serializable {
    var text: String?
    var isVisible: Bool?
    var fileExists: Bool?
    var previewExists: Bool?
    var attachments: [MediaInfo]?
}

struct ChatNotificationRequest: Serializable {
    var name: String
    var text: String?
    var data: Data? // TODO: should be of JSON type
    var realm: NotificationRealm = .webSocket
}
