import Foundation

/// A language descriptor, e.g. {"code":"EN","name":"English","nativeName":"English"}.
/// Full language objects live only in the journal `languages` setting; messages and users store just the code.
struct Language: Serializable, Equatable {
    var code: String
    var name: String
    var nativeName: String
}

extension Language {

    /// Human-readable name, e.g. "Español (Spanish)", or just "English" when both names match.
    func displayedName() -> String {
        nativeName == name ? name : "\(nativeName) (\(name))"
    }

    /// True when a code is non-empty, reasonably short and safe to use in filters.
    static func isValidCode(_ code: String) -> Bool {
        !code.isEmpty && code.count <= 16 && code.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" }
    }

    /// Validates a decoded JSON value as a non-empty list of languages (used for the journal `languages` setting).
    static func validateList(_ value: Any?) throws {
        guard let value,
              JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value),
              let languages = try? JSONDecoder().decode([Language].self, from: data),
              !languages.isEmpty,
              languages.allSatisfy({ $0.isValid }) else {
            throw ServiceError(.badRequest, reason: "Invalid languages JSON. Expected a non-empty array of {\"code\":...,\"name\":...,\"nativeName\":...}.")
        }
    }

    var isValid: Bool {
        Self.isValidCode(code) && !name.trim().isEmpty && !nativeName.trim().isEmpty
    }
}
