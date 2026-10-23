import Foundation

struct ProductInfo: Serializable {
    var productName = "Chat Server"
    var version = "0.9.50"
    var apiVersion = "0.9"
}

struct IndexContext: Encodable {
    let productInfo = ProductInfo()
    let registrationOpen: Bool
    /// Whether new passwords must follow the complexity rules (see `PasswordPolicy`).
    let passwordRulesEnforced: Bool
    /// The password rules, for labels and placeholders. The pages take them from here only.
    let passwordRules = PasswordPolicy.description
    /// The same rules as a JSON string, already escaped for a `<script>` tag.
    let passwordRulesJSON = scriptSafeJSON(PasswordPolicy.description, fallback: "\"\"")
    /// Suggestions for the security question, already escaped for a `<script>` tag.
    let securityQuestionsJSON = SecurityQuestions.json
}

struct MainContext: Encodable {
    let productInfo = ProductInfo()
    let serverMessage: String?
    /// Whether new passwords must follow the complexity rules (see `PasswordPolicy`).
    let passwordRulesEnforced: Bool
    /// The password rules, for labels and placeholders. The pages take them from here only.
    let passwordRules = PasswordPolicy.description
    /// The same rules as a JSON string, already escaped for a `<script>` tag.
    let passwordRulesJSON = scriptSafeJSON(PasswordPolicy.description, fallback: "\"\"")
    /// Suggestions for the security question, already escaped for a `<script>` tag.
    let securityQuestionsJSON = SecurityQuestions.json
}
