import Foundation

struct ProductInfo: Serializable {
    var productName = "Chat Server"
    var version = "0.9.2"
    var apiVersion = "0.9"
}

struct IndexContext: Encodable {
    let productInfo = ProductInfo()
    let registrationOpen: Bool
}

struct MainContext: Encodable {
    let productInfo = ProductInfo()
    let serverMessage: String?
}
