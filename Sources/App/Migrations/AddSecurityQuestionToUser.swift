import Fluent

/// Adds the security question used for password recovery. The answer is stored as a bcrypt hash, the same way the password is.
struct AddSecurityQuestionToUser: AsyncMigration {
    var name: String { "AddSecurityQuestionToUser" }

    func prepare(on database: Database) async throws {
        try await database.schema("users")
            .field("security_question", .string)
            .field("security_answer_hash", .string)
            .update()
    }

    func revert(on database: Database) async throws {
        try await database.schema("users")
            .deleteField("security_question")
            .deleteField("security_answer_hash")
            .update()
    }
}
