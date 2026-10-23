// Generate a unique device ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Centralized registration function
async function performRegistration(name, username, password, securityQuestion, securityAnswer, deviceInfo) {
    const data = await apiRegisterUser(name, username, password, deviceInfo, securityQuestion, securityAnswer);
    
    // Store user data with access token in currentUser
    const currentUserData = {
        info: data.info,
        session: data.deviceSessions[0]
    };
    localStorage.setItem('currentUser', JSON.stringify(currentUserData));
    return currentUserData;
}

// Get device info automatically
function getDeviceInfo() {
    const userAgent = navigator.userAgent;
    let deviceName = 'Web Browser';
    let deviceModel = 'Unknown';
    
    // Extract browser name
    if (userAgent.includes('Chrome')) {
        deviceName = 'Chrome Browser';
    } else if (userAgent.includes('Firefox')) {
        deviceName = 'Firefox Browser';
    } else if (userAgent.includes('Safari')) {
        deviceName = 'Safari Browser';
    } else if (userAgent.includes('Edge')) {
        deviceName = 'Edge Browser';
    }
    
    // Extract OS info
    if (userAgent.includes('Windows')) {
        deviceModel = 'Windows PC';
    } else if (userAgent.includes('Mac')) {
        deviceModel = 'Mac';
    } else if (userAgent.includes('Linux')) {
        deviceModel = 'Linux PC';
    } else if (userAgent.includes('Android')) {
        deviceModel = 'Android Device';
    } else if (userAgent.includes('iPhone')) {
        deviceModel = 'iPhone';
    } else if (userAgent.includes('iPad')) {
        deviceModel = 'iPad';
    }
    
    return {
        id: generateUUID(),
        name: deviceName,
        model: deviceModel,
        token: null, // Will be set after getting push subscription
        transport: 'web'
    };
}

// The suggested security questions, shown under the field's chevron.
// Picking one only fills the field in, so the user can still edit it.
function toggleQuestionMenu() {
    const combo = document.getElementById('questionCombo');
    if (combo.classList.contains('open')) {
        combo.classList.remove('open');
        return;
    }
    const menu = document.getElementById('questionMenu');
    menu.innerHTML = '';
    SECURITY_QUESTIONS.forEach(function (question) {
        const item = document.createElement('div');
        item.className = 'combo-item';
        item.textContent = question;
        item.onclick = function () {
            const field = document.getElementById('securityQuestion');
            field.value = question;
            combo.classList.remove('open');
            field.focus();
            field.closest('.form-group').classList.remove('error');
        };
        menu.appendChild(item);
    });
    combo.classList.add('open');
}

document.addEventListener('click', function (event) {
    const combo = document.getElementById('questionCombo');
    if (combo && !combo.contains(event.target)) combo.classList.remove('open');
});

document.getElementById('registerForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    const name = document.getElementById('name').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const securityQuestion = document.getElementById('securityQuestion').value.trim();
    const securityAnswer = document.getElementById('securityAnswer').value.trim();
    const button = document.querySelector('.register-button');

    clearErrors();

    // These mirror the server's rules in UserService, so most mistakes are caught before the request.
    if (!name) {
        showFieldError('name', 'Full name is required.');
        return;
    }
    if (!username) {
        showFieldError('username', 'Username is required.');
        return;
    }
    if (!/^\p{L}[\p{L}\p{Nd}]{4,24}$/u.test(username)) {
        showFieldError('username', 'Username must be 5-25 letters or digits and start with a letter.');
        return;
    }
    const problem = passwordProblem(password);
    if (problem) {
        showFieldError('password', problem);
        return;
    }
    if (password !== confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match.');
        return;
    }
    if (!securityQuestion) {
        showFieldError('securityQuestion', 'Please choose or write a security question.');
        return;
    }
    if (!securityAnswer) {
        showFieldError('securityAnswer', 'An answer is required.');
        return;
    }

    button.disabled = true;
    button.classList.add('loading');
    button.textContent = 'Creating account...';

    try {
        const deviceInfo = await getDeviceInfoWithPush();
        await performRegistration(name, username, password, securityQuestion, securityAnswer, deviceInfo);
        // Registration logs the user in immediately.
        window.location.href = '/main';
    } catch (error) {
        console.error('Registration error:', error);
        if (error.status === 409) {
            showFieldError('username', 'Username already taken.');
        } else if (error.status) {
            showStatus(apiErrorReason(error) || 'Registration failed.', 'error');
        } else {
            showStatus('Network error. Please try again.', 'error');
        }
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = 'Create Account';
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
