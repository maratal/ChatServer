// Generate a unique device ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Centralized login function
async function performLogin(username, password, deviceInfo) {
    const data = await apiLoginUser(username, password, deviceInfo);
    
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

document.getElementById('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const button = document.querySelector('.login-button');

    clearErrors();

    if (!username) {
        showFieldError('username', 'Username is required.');
        return;
    }
    if (!password) {
        showFieldError('password', 'Password is required.');
        return;
    }

    button.disabled = true;
    button.classList.add('loading');
    button.textContent = 'Signing in...';

    try {
        const deviceInfo = await getDeviceInfoWithPush();
        await performLogin(username, password, deviceInfo);
        window.location.href = '/main';
    } catch (error) {
        console.error('Login error:', error);
        if (error.status === 401) {
            showStatus('Invalid username or password.', 'error');
        } else if (error.status) {
            showStatus(apiErrorReason(error) || 'Login failed.', 'error');
        } else {
            showStatus('Network error. Please try again.', 'error');
        }
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
        button.textContent = 'Sign In';
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
