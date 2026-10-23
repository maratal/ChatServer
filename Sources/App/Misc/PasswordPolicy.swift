import Foundation

/// The rules a new password must follow.
///
/// A production server enforces the usual complexity rules. A server running locally
/// (the development and testing environments) accepts any non-empty password, so that
/// test accounts can use short, simple passwords.
struct PasswordPolicy: Sendable {

    /// Whether the complexity rules apply. Only true in the production environment.
    let enforced: Bool

    static let minLength = 8
    static let maxLength = 25

    /// The rules in one sentence, for error messages and the hint under password fields.
    static let description = "Password must be \(minLength)-\(maxLength) characters and contain an uppercase letter, a lowercase letter and a digit."

    func isValid(_ password: String) -> Bool {
        guard enforced else {
            return !password.isEmpty
        }
        return password.count >= Self.minLength
            && password.count <= Self.maxLength
            && password.contains(where: { $0.isUppercase })
            && password.contains(where: { $0.isLowercase })
            && password.contains(where: { $0.isNumber })
    }

    /// The error for a password that `isValid` rejected.
    var error: ServiceError {
        ServiceError(.badRequest, reason: enforced ? Self.description : "Password is required.")
    }
}
