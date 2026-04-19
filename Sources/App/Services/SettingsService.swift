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

    /// Returns the current system message, or nil if not set.
    func serverMessage() async throws -> String?

    /// Returns true if the index page should redirect to the admin's journal when users are registered.
    func isJournalAtIndexEnabled() async throws -> Bool
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
        ),
        "message": SettingDefault(
            value: "",
            meta: #"{"title":"System Message","description":"A message shown to all users on the main page. Leave empty to disable."}"#
        ),
        "journalAtIndex": SettingDefault(
            value: "disabled",
            meta: #"{"title":"Journal at Index","variants":"disabled,enabled","description":"When enabled, the home page redirects to the admin's journal if users are registered."}"#
        )
    ]

    init(repo: SettingsRepository) {
        self.repo = repo
    }

    func allSettings() async throws -> [ServerSettingInfo] {
        let stored = try await repo.all()
        return Self.defaults.keys.compactMap { name in
            guard let def = Self.defaults[name] else { return nil }
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

    func serverMessage() async throws -> String? {
        guard let setting = try await repo.find(name: "message"), !setting.value.trim().isEmpty else {
            return nil
        }
        return setting.value
    }

    func isJournalAtIndexEnabled() async throws -> Bool {
        guard let setting = try await repo.find(name: "journalAtIndex") else {
            return false
        }
        return setting.value == "enabled"
    }
}

extension String {
    func trim() -> String {
        return trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
