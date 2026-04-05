/**
 * This controller routes settings requests to the settings service. Do not add any logic here.
 */
import Vapor

struct SettingsController: RouteCollection {

    let service: SettingsServiceProtocol

    func boot(routes: RoutesBuilder) throws {
        let protectedPath = routes.grouped("api", "settings").grouped(DeviceSession.authenticator())
        protectedPath.get(use: getSettings)
        protectedPath.put(":name", use: saveSetting)
    }

    func getSettings(_ req: Request) async throws -> [ServerSettingInfo] {
        guard try req.authenticatedUser().id == 1 else {
            throw Abort(.forbidden)
        }
        return try await service.allSettings()
    }

    func saveSetting(_ req: Request) async throws -> ServerSettingInfo {
        guard try req.authenticatedUser().id == 1 else {
            throw Abort(.forbidden)
        }
        let settingName = try req.parameters.require("name")
        let body = try req.content.decode(SaveSettingRequest.self)
        return try await service.saveSetting(name: settingName, value: body.value)
    }
}

struct SaveSettingRequest: Content {
    var value: String
}
