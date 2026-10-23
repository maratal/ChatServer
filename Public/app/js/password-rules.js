// The rules for new passwords, matching PasswordPolicy on the server.
// The pages always describe the production rules. PASSWORD_RULES_ENFORCED, templated into
// the page, only decides whether a password is actually checked against them: a production
// server enforces them, while one running locally accepts any non-empty password.

const PASSWORD_RULES_DESCRIPTION = 'Password must be 8-25 characters and contain an uppercase letter, a lowercase letter and a digit.';

// Returns what is wrong with the password, or null if it is acceptable.
function passwordProblem(password) {
    if (!password) {
        return 'Password is required.';
    }
    if (typeof PASSWORD_RULES_ENFORCED === 'undefined' || !PASSWORD_RULES_ENFORCED) {
        return null;
    }
    const valid = password.length >= 8 && password.length <= 25
        && /\p{Lu}/u.test(password)
        && /\p{Ll}/u.test(password)
        && /\p{N}/u.test(password);
    return valid ? null : PASSWORD_RULES_DESCRIPTION;
}
