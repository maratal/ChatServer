/**
 * Protocol for services that have a current user context.
 */
import Foundation

protocol LoggedIn: Actor {
    var currentUser: User? { get }
    func with(_ currentUser: User?) -> Self
}

extension LoggedIn {
    var isLoggedIn: Bool { currentUser != nil }
}
