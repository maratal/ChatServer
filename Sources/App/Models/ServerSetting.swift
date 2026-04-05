import Fluent
import Foundation

final class ServerSetting: RepositoryItem, @unchecked Sendable {
    static let schema = "settings"

    @ID(key: .id)
    var id: UUID?

    @Field(key: "name")
    var name: String

    @Field(key: "value")
    var value: String

    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    init(name: String, value: String) {
        self.name = name
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
