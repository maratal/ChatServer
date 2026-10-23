// The username found in step 1, sent again with the answer in step 2.
let currentUsername = '';

// Step 1: look up the account's security question.
document.getElementById('lookupForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const username = document.getElementById('username').value.trim();
    clearErrors();

    if (!username) {
        showFieldError('username', 'Username is required.');
        return;
    }

    try {
        const data = await apiRecoverQuestion(username);
        currentUsername = username;
        document.getElementById('questionLabel').textContent = data.question;
        document.getElementById('lookupForm').style.display = 'none';
        document.getElementById('resetForm').style.display = '';
        document.getElementById('answer').focus();
    } catch (error) {
        showStatus(error.status ? (apiErrorReason(error) || 'Account not found.') : 'Network error. Please try again.', 'error');
    }
});

// Step 2: verify the answer and set a new password.
document.getElementById('resetForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const answer = document.getElementById('answer').value.trim();
    const newPassword = document.getElementById('newPassword').value;
    clearErrors();

    if (!answer) {
        showFieldError('answer', 'An answer is required.');
        return;
    }
    const problem = passwordProblem(newPassword);
    if (problem) {
        showFieldError('newPassword', problem);
        return;
    }

    try {
        await apiRecoverReset(currentUsername, answer, newPassword);
        showStatus('Password reset. Redirecting to sign in...', 'success');
        setTimeout(function () { window.location.href = '/login'; }, 1500);
    } catch (error) {
        showStatus(error.status ? (apiErrorReason(error) || 'Could not reset password.') : 'Network error. Please try again.', 'error');
    }
});

// Shows an error under a field; it stays until the next submit or until the field is edited.
function showFieldError(fieldId, message) {
    const group = document.getElementById(fieldId).closest('.form-group');
    group.classList.add('error');
    group.querySelector('.error-popup').textContent = message;
}

function clearErrors() {
    document.querySelectorAll('.form-group').forEach(function (group) {
        group.classList.remove('error');
        const popup = group.querySelector('.error-popup');
        if (popup) popup.textContent = '';
    });
    document.getElementById('statusMessage').style.display = 'none';
}

function showStatus(message, type) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.className = `status-message ${type}`;
    statusMessage.textContent = message;
    statusMessage.style.display = 'block';
}

// Editing a field clears its error.
document.querySelectorAll('.form-group input').forEach(function (input) {
    input.addEventListener('input', function () {
        const group = this.closest('.form-group');
        if (group) group.classList.remove('error');
    });
});
