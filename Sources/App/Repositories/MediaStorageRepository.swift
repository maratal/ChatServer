import FluentKit

protocol MediaStorageRepository: Sendable {
    func findRecentMedia(for userId: UserID, offset: Int, limit: Int) async throws -> [MediaResource]
    func deleteMediaResource(_ resource: MediaResource) async throws
}

actor MediaStorageDatabaseRepository: DatabaseRepository, MediaStorageRepository {

    let database: any Database

    init(database: any Database) {
        self.database = database
    }

    func findRecentMedia(for userId: UserID, offset: Int, limit: Int) async throws -> [MediaResource] {
        try await MediaResource.query(on: database)
            .filter(\.$owner.$id == userId)
            .sort(\.$uploadedAt, .descending)
            .range(offset..<(offset + limit))
            .all()
    }

    func deleteMediaResource(_ resource: MediaResource) async throws {
        guard let resourceId = resource.id else { return }
        try await MessageToMedia.query(on: database)
            .filter(\.$mediaResource.$id == resourceId)
            .delete()
        try await resource.delete(on: database)
    }
}
