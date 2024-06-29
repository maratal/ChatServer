import Foundation

struct RegistrationRequest: Serializable {
    var name: String
    var username: String
    var password: String
    var deviceInfo: DeviceInfo
}

struct ChangePasswordRequest: Serializable {
    var oldPassword: String
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
    var isPersonal: Bool
}

struct UpdateUserRequest: Serializable {
    var name: String?
    var about: String?
    var photo: MediaInfo?
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
    var localId: UUID?
    var text: String?
    var isVisible: Bool?
    var attachment: MediaInfo?
}

struct UpdateMessageRequest: Serializable {
    var text: String?
    var isVisible: Bool?
    var fileExists = false
    var previewExists = false
}
