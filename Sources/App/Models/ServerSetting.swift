import Fluent
import Foundation

final class ServerSetting: RepositoryItem, @unchecked Sendable {
    static let schema = "settings"

    @ID(custom: "name", generatedBy: .user)
    var id: String?

    var name: String {
        get { id! }
        set { id = newValue }
    }

    @Field(key: "value")
    var value: String

    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    init(name: String, value: String) {
        self.id = name
        self.value = value
    }
}

extension ServerSetting {

    struct Info: Serializable {
        var name: String
        var value: String
        var meta: String
        var updatedAt: Date?
    }

    func info(meta: String) -> Info {
        Info(name: name, value: value, meta: meta, updatedAt: updatedAt)
    }
}

typealias ServerSettingInfo = ServerSetting.Info
