import Foundation

struct ProductInfo: Encodable {
    let productName = "Chat Server"
    let version = "0.1.0"
    let apiVersion = "0.9"
}

struct IndexContext: Encodable {
    let productInfo = ProductInfo()
    let registrationOpen: Bool
}

struct MainContext: Encodable {
    let productInfo = ProductInfo()
    let serverMessage: String?
}
