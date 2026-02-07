import Vapor
import Crypto

actor WebPushSender: PushSender {
    private let core: CoreService
    private let app: Application
    private let vapidPrivateKey: String?
    private let vapidPublicKey: String?
    private let vapidSubject: String?
    
    init(core: CoreService, app: Application, vapidPrivateKey: String?, vapidPublicKey: String?, vapidSubject: String?) {
        self.core = core
        self.app = app
        self.vapidPrivateKey = vapidPrivateKey
        self.vapidPublicKey = vapidPublicKey
        self.vapidSubject = vapidSubject
    }
    
    func send(_ notification: CoreService.Notification, to device: DeviceInfo) async {
        guard let subscriptionJSON = device.token, device.transport == .web else {
            return core.logger.debug("Can't send Web Push without subscription token.")
        }
        
        guard let vapidPrivateKey = vapidPrivateKey, 
              let vapidPublicKey = vapidPublicKey,
              let vapidSubject = vapidSubject else {
            return core.logger.warning("Web Push not configured: missing VAPID keys or subject")
        }
        
        do {
            // 1. Parse subscription JSON
            guard let subscriptionData = subscriptionJSON.data(using: .utf8),
                  let subscription = try? JSONDecoder().decode(PushSubscription.self, from: subscriptionData) else {
                return core.logger.error("Failed to decode push subscription JSON")
            }
            
            // 2. Parse endpoint URL for audience
            guard let endpointURL = URL(string: subscription.endpoint),
                  let host = endpointURL.host else {
                return core.logger.error("Invalid push endpoint URL")
            }
            let audience = "\(endpointURL.scheme ?? "https")://\(host)"
            
            // 3. Create VAPID JWT
            let jwt = try createVAPIDJWT(audience: audience, subject: vapidSubject, privateKey: vapidPrivateKey)
            
            // 4. Send HTTP POST request WITHOUT encryption (for testing)
            // Note: This sends an empty body, which triggers the push event
            let response = try await app.client.post(URI(string: subscription.endpoint)) { req in
                req.headers.add(name: "TTL", value: "86400")
                req.headers.add(name: "Urgency", value: "high")
                req.headers.add(name: HTTPHeaders.Name.authorization, value: "vapid t=\(jwt), k=\(vapidPublicKey)")
                // Empty body - no encryption needed
            }
            
            core.logger.info("'WEBPUSH' push sent to endpoint: \(subscription.endpoint)")
            core.logger.info("'WEBPUSH' response status: \(response.status)")
            
            if response.status == HTTPStatus.created || response.status == HTTPStatus.ok {
                core.logger.info("'WEBPUSH' push '\(notification.event)' successfully sent to device")
            } else {
                core.logger.warning("Web Push sent but received status \(response.status)")
            }
            
        } catch {
            core.logger.error("Failed to send Web Push: \(error)")
        }
    }
    
    private func createVAPIDJWT(audience: String, subject: String, privateKey: String) throws -> String {
        // Decode base64url private key
        guard let keyData = Data(base64URLEncoded: privateKey) else {
            throw Abort(.internalServerError, reason: "Invalid VAPID private key")
        }
        
        let privateKeyObj = try P256.Signing.PrivateKey(rawRepresentation: keyData)
        
        // Create JWT header and payload
        let header = ["typ": "JWT", "alg": "ES256"]
        let exp = Int(Date().addingTimeInterval(43200).timeIntervalSince1970)
        let payload = ["aud": audience, "exp": exp, "sub": subject] as [String : Any]
        
        guard let headerData = try? JSONSerialization.data(withJSONObject: header),
              let payloadData = try? JSONSerialization.data(withJSONObject: payload) else {
            throw Abort(.internalServerError, reason: "Failed to create JWT")
        }
        
        let headerB64 = headerData.base64URLEncodedString()
        let payloadB64 = payloadData.base64URLEncodedString()
        let message = "\(headerB64).\(payloadB64)"
        
        guard let messageData = message.data(using: .utf8) else {
            throw Abort(.internalServerError, reason: "Failed to encode JWT message")
        }
        
        let signature = try privateKeyObj.signature(for: SHA256.hash(data: messageData))
        let signatureB64 = signature.rawRepresentation.base64URLEncodedString()
        
        return "\(message).\(signatureB64)"
    }
}

// MARK: - Supporting Types

struct PushSubscription: Codable {
    let endpoint: String
    let keys: Keys
    
    struct Keys: Codable {
        let p256dh: String
        let auth: String
    }
}

extension Data {
    init?(base64URLEncoded string: String) {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        
        let paddingLength = (4 - base64.count % 4) % 4
        base64 += String(repeating: "=", count: paddingLength)
        
        self.init(base64Encoded: base64)
    }
    
    func base64URLEncodedString() -> String {
        return self.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
