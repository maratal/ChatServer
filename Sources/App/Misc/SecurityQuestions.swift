import Foundation

/// The security questions the sign-up page and the profile offer.
///
/// The field is editable, so these are only suggestions and nothing validates against them.
/// The list lives on the server and is templated into the pages, so the pages cannot drift apart.
enum SecurityQuestions {

    static let suggested: [String] = [
        "What was the name of your first pet?",
        "What city were you born in?",
        "What was the name of your first school?",
        "What is your mother's maiden name?",
        "What was the make of your first car?",
    ]

    /// The list as a JSON array that is safe to put inside a `<script>` tag.
    /// Every `<` is escaped, so a question can never close the tag it is in.
    static let json: String = {
        guard let data = try? JSONEncoder().encode(suggested), let string = String(data: data, encoding: .utf8) else {
            return "[]"
        }
        return string.replacingOccurrences(of: "<", with: "\\u003c")
    }()
}
