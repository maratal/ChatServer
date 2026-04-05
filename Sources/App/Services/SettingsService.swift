/**
 * This file abstracts server settings logic. Do not add any other import except `Foundation`.
 */
import Foundation

protocol SettingsServiceProtocol: Sendable {

    /// Returns all settings, applying defaults for any missing entries.
    func allSettings() async throws -> [ServerSettingInfo]

    /// Saves a setting value. Returns the updated setting.
    func saveSetting(name: String, value: String) async throws -> ServerSettingInfo

    /// Returns true if user registration is currently open.
    func isRegistrationOpen() async throws -> Bool
}

actor SettingsService: SettingsServiceProtocol {

    let repo: SettingsRepository

    struct SettingDefault {
        let value: String
        let meta: String
    }

    static let defaults: [String: SettingDefault] = [
        "registration": SettingDefault(
            value: "opened",
            meta: #"{"title":"Registration","variants":"opened,closed","description":"Whether new users can register on your server."}"#
        )
    ]

    init(repo: SettingsRepository) {
        self.repo = repo
    }

    func allSettings() async throws -> [ServerSettingInfo] {
        let stored = try await repo.all()
        return Self.defaults.keys.sorted().map { name in
            let def = Self.defaults[name]!
            if let setting = stored.first(where: { $0.name == name }) {
                return setting.info(meta: def.meta)
            }
            return ServerSettingInfo(name: name, value: def.value, meta: def.meta, updatedAt: nil)
        }
    }

    func saveSetting(name: String, value: String) async throws -> ServerSettingInfo {
        guard let def = Self.defaults[name] else {
            throw ServiceError(.badRequest, reason: "Unknown setting: \(name).")
        }
        if let existing = try await repo.find(name: name) {
            existing.value = value
            try await repo.save(existing)
            return existing.info(meta: def.meta)
        } else {
            let setting = ServerSetting(name: name, value: value)
            try await repo.save(setting)
            return setting.info(meta: def.meta)
        }
    }

    func isRegistrationOpen() async throws -> Bool {
        guard let setting = try await repo.find(name: "registration") else {
            return true
        }
        return setting.value != "closed"
    }
}
