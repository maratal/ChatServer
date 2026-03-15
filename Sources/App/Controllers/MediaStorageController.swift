/**
 * This controller object just redirects everything to the appropriate service actor. Do not add any logic here.
 */
import Vapor

struct MediaStorageController: RouteCollection {

    let service: MediaStorageServiceProtocol

    func boot(routes: RoutesBuilder) throws {
        let protected = routes.grouped("media").grouped(DeviceSession.authenticator())
        protected.get("recents", use: recentMedia)
        protected.delete(.id, use: deleteMedia)
    }

    func recentMedia(_ req: Request) async throws -> [MediaInfo] {
        let currentUser = try await req.requireCurrentUser()
        let offset = req.query[Int.self, at: "offset"] ?? 0
        let limit = req.query[Int.self, at: "limit"] ?? 20
        return try await service.with(currentUser).recentMedia(for: currentUser.requireID(), offset: offset, limit: limit)
    }

    func deleteMedia(_ req: Request) async throws -> HTTPStatus {
        let currentUser = try await req.requireCurrentUser()
        try await service.with(currentUser).deleteMedia(req.objectUUID(), by: currentUser.requireID())
        return .ok
    }
}
