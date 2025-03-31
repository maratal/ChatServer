import Foundation

struct ProductInfo {
    static let productName = "Demo Chat Server" // naming in progress
    static let version = "0.1.0"
    static let apiVersion = "0.9"
    
    static var fullVersion: String {
        return "\(productName) v\(version)"
    }
}
