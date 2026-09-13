import Fluent
import Foundation

typealias InstallID = UUID

/// One row per browser that has used the app, keyed by the `install_id` cookie
/// it was issued on its first visit.
///
/// This counts installs, not people: a second browser is a second row, and a
/// cleared cookie jar is a new one. It is the most an app without a login on
/// every page can honestly say about its audience.
final class Install: RepositoryItem, @unchecked Sendable {
    static let schema = "installs"

    @ID(key: .id)
    var id: InstallID?

    /// The cookie value. Unique — one row per install.
    @Field(key: "install_id")
    var installID: String

    /// Requests served under this cookie, lifetime.
    @Field(key: "request_count")
    var requestCount: Int

    @Timestamp(key: "created_at", on: .create)
    var createdAt: Date?

    /// When this install was last seen — written by the flush, so it is only
    /// ever as fresh as the last one. Today's figure is the rows stamped inside
    /// the last 24 hours.
    @Timestamp(key: "updated_at", on: .update)
    var updatedAt: Date?

    init() {}

    init(installID: String, requestCount: Int) {
        self.installID = installID
        self.requestCount = requestCount
    }
}
