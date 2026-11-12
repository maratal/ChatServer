/**
 * This file abstracts media storage logic from everything else. Do not add any other import except `Foundation`.
 */
import Foundation

protocol MediaStorageServiceProtocol: LoggedIn {

    /// Returns recently uploaded media resources by the user, sorted by upload date descending.
    func recentMedia(for userId: UserID, offset: Int, limit: Int) async throws -> [MediaInfo]

    /// Creates the media resource for a file just uploaded as a message attachment,
    /// so it is listed in the user's recent media whether or not it is ever sent.
    func saveMedia(_ media: MediaInfo, by userId: UserID) async throws -> MediaInfo

    /// Deletes a media resource and its files if it belongs to the user.
    /// Throws `.notFound` if there is no such resource and `.forbidden` if it belongs to someone else.
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

    func saveMedia(_ media: MediaInfo, by userId: UserID) async throws -> MediaInfo {
        guard let id = media.id else {
            throw ServiceError(.badRequest, reason: "Media id is required.")
        }
        // The file type becomes part of the file name, so it must not be able to point outside the uploads folder.
        guard !media.fileType.isEmpty, media.fileType.allSatisfy({ $0.isLetter || $0.isNumber }) else {
            throw ServiceError(.badRequest, reason: "Invalid file type.")
        }
        // Saving the same file again keeps the existing record.
        if let existing = try await repo.findMediaResource(id) {
            return existing.info()
        }
        // The web client names uploads with lowercase UUIDs, while UUID descriptions are uppercase,
        // so both spellings are checked for case-sensitive file systems.
        let fileName = "\(id).\(media.fileType)"
        guard let uploadedFileName = [fileName, fileName.lowercased()].first(where: {
            FileManager.default.fileExists(atPath: core.uploadPath(for: $0))
        }) else {
            throw ServiceError(.notFound, reason: "Uploaded file not found.")
        }
        let resource = MediaResource(id: id,
                                     owner: userId,
                                     fileType: media.fileType,
                                     fileSize: media.fileSize,
                                     previewWidth: media.previewWidth ?? 300,
                                     previewHeight: media.previewHeight ?? 200,
                                     uploadedAt: core.fileCreationDate(for: uploadedFileName) ?? Date(),
                                     duration: media.duration)
        try await repo.saveMediaResource(resource)
        return resource.info()
    }

    func deleteMedia(_ id: ResourceID, by userId: UserID) async throws {
        guard let resource = try await repo.findMediaResource(id) else {
            throw ServiceError(.notFound, reason: "Media resource not found.")
        }
        guard resource.$owner.id == userId else {
            throw ServiceError(.forbidden, reason: "Media resource is not owned by you.")
        }
        try? core.removeFiles(for: resource)
        try await repo.deleteMediaResource(resource)
    }
}
