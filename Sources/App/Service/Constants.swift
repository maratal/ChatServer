import Foundation

struct Service {
    
    struct Constants {
        static var minPasswordLength = 8
        static var maxPasswordLength = 25
        static var minUsernameLength = 5
        static var maxUsernameLength = 25
        static var minAccountKeyLength = 25
        static var maxAccountKeyLength = 100
    }
    
    struct Errors {
        static var invalidUser       = ServiceError(.notFound, reason: "User was not found.")
        static var invalidPassword   = ServiceError(.badRequest, reason: "Invalid user or password.")
        static var invalidAccountKey = ServiceError(.badRequest, reason: "Invalid user or account key.")
        static var badPassword       = ServiceError(.badRequest, reason: "Password should be at least \(Constants.minPasswordLength) characters length.")
        static var badAccountKey     = ServiceError(.badRequest, reason: "Key should be at least \(Constants.minAccountKeyLength) characters length.")
        static var badName           = ServiceError(.badRequest, reason: "Name should consist of letters.")
        static var badUsername       = ServiceError(.badRequest, reason: "Username should be at least \(Constants.minUsernameLength) characters length, start with letter and consist of letters and digits.")
    }
}
