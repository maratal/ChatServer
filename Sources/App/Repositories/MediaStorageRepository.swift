import FluentKit

protocol MediaStorageRepository: Sendable {
    func findRecentMedia(for userId: UserID, limit: Int) async throws -> [MediaResource]
    func deleteMediaResource(_ resource: MediaResource) async throws
}

actor MediaStorageDatabaseRepository: DatabaseRepository, MediaStorageRepository {

    let database: any Database

    init(database: any Database) {
        self.database = database
    }

    func findRecentMedia(for userId: UserID, limit: Int) async throws -> [MediaResource] {
        let all = try await MediaResource.query(on: database)
            .join(MessageToMedia.self, on: \MediaResource.$id == \MessageToMedia.$mediaResource.$id)
            .join(Message.self, on: \MessageToMedia.$message.$id == \Message.$id)
            .filter(Message.self, \.$author.$id == userId)
            .sort(\.$uploadedAt, .descending)
            .all()
        // Deduplicate by ID (a resource reused across messages will appear once per pivot row)
        var seen = Set<ResourceID>()
        return all.filter { resource in
            guard let id = resource.id else { return false }
            return seen.insert(id).inserted
        }.prefix(limit).map { $0 }
    }

    func deleteMediaResource(_ resource: MediaResource) async throws {
        guard let resourceId = resource.id else { return }
        try await MessageToMedia.query(on: database)
            .filter(\.$mediaResource.$id == resourceId)
            .delete()
        try await resource.delete(on: database)
    }
}
