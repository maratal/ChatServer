/**
 * This file abstracts media storage logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol MediaStorageServiceProtocol: LoggedIn {

    /// Returns recently uploaded media resources by the user, sorted by upload date descending.
    func recentMedia(for userId: UserID, offset: Int, limit: Int) async throws -> [MediaInfo]

    /// Deletes a media resource and its files if it belongs to the user.
    func deleteMedia(_ id: ResourceID, by userId: UserID) async throws
}

actor MediaStorageService: MediaStorageServiceProtocol {

    private let core: CoreService
    let repo: MediaStorageRepository
    var currentUser: User?

    init(core: CoreService, repo: MediaStorageRepository) {
        self.core = core
        self.repo = repo
    }

    func with(_ currentUser: User?) -> MediaStorageService {
        self.currentUser = currentUser
        return self
    }

    func recentMedia(for userId: UserID, offset: Int = 0, limit: Int = 20) async throws -> [MediaInfo] {
        let resources = try await repo.findRecentMedia(for: userId, offset: offset, limit: limit)
        return resources.map { $0.info() }
    }

    func deleteMedia(_ id: ResourceID, by userId: UserID) async throws {
        // Verify the resource belongs to a message authored by this user
        let resources = try await repo.findRecentMedia(for: userId, offset: 0, limit: 10000)
        guard let resource = resources.first(where: { $0.id == id }) else {
            throw ServiceError(.forbidden, reason: "Media resource not found or not owned by you.")
        }
        try? core.removeFiles(for: resource)
        try await repo.deleteMediaResource(resource)
    }
}
