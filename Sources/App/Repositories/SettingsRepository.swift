import FluentKit
import Foundation

protocol SettingsRepository: Sendable {
    func all() async throws -> [ServerSetting]
    func find(name: String) async throws -> ServerSetting?
    func save(_ setting: ServerSetting) async throws
}

actor SettingsDatabaseRepository: DatabaseRepository, SettingsRepository {

    let database: any Database

    init(database: any Database) {
        self.database = database
    }

    func all() async throws -> [ServerSetting] {
        try await ServerSetting.query(on: database).all()
    }

    func find(name: String) async throws -> ServerSetting? {
        try await ServerSetting.query(on: database)
            .filter(\.$name == name)
            .first()
    }

    func save(_ setting: ServerSetting) async throws {
        try await setting.save(on: database)
    }
}
