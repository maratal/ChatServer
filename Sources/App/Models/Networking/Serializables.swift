import Foundation

struct RegistrationRequest: Serializable {
    var name: String
    var username: String
    var password: String
}

struct LoginResponse: Serializable {
    var info: UserInfo
    var token: String
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

struct ChangeAccountKeyRequest: Serializable {
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
    var imageUrl: String?
}

struct UpdateChatRequest: Serializable {
    var title: String?
    var isMuted: Bool?
    var isArchived: Bool?
    var isBlocked: Bool?
    var isRemovedOnDevice: Bool?
}

struct UpdateChatUsersRequest: Serializable {
    var users: [UserID]
}

struct PostMessageRequest: Serializable {
    var localId: UUID?
    var text: String?
    var fileType: String?
    var fileSize: Int64?
    var previewWidth: Int?
    var previewHeight: Int?
    var isVisible: Bool?
}
