// Generate a unique device ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Centralized login function
async function performLogin(username, password, deviceInfo) {
    // Create Basic Auth header
    const credentials = btoa(`${username}:${password}`);
    
    const response = await fetch('/users/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify(deviceInfo)
    });
    
    const data = await response.json();
    
    if (response.ok) {
        // Store user data with access token in currentUser
        const currentUserData = {
            info: data.info,
            session: data.deviceSessions[0]
        };
        localStorage.setItem('currentUser', JSON.stringify(currentUserData));
        return { success: true, data: currentUserData };
    } else {
        return { success: false, error: data, status: response.status };
    }
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
        token: null, // No push support for web yet
        transport: 'web'
    };
}

// Show error for a specific field
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    const errorPopup = formGroup.querySelector('.error-popup');
    
    formGroup.classList.add('error');
    errorPopup.textContent = message;
    
    // Auto-hide error after 5 seconds
    setTimeout(() => {
        hideFieldError(fieldId);
    }, 5000);
}

// Hide error for a specific field
function hideFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const formGroup = field.closest('.form-group');
    formGroup.classList.remove('error');
}

// Show status message
function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;
    statusEl.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }
}

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Clear previous errors
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    const button = document.querySelector('.login-button');
    button.classList.add('loading');
    button.textContent = 'Signing in...';
    button.disabled = true;
    
    const formData = {
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
        deviceInfo: getDeviceInfo()
    };
    
    // Basic validation
    let hasErrors = false;
    
    if (!formData.username) {
        showFieldError('username', 'Username is required');
        hasErrors = true;
    }
    
    if (!formData.password) {
        showFieldError('password', 'Password is required');
        hasErrors = true;
    }
    
    if (hasErrors) {
        button.classList.remove('loading');
        button.textContent = 'Sign In';
        button.disabled = false;
        return;
    }
    
    try {
        const result = await performLogin(formData.username, formData.password, formData.deviceInfo);
        
        if (result.success) {
            showStatus('Login successful! Redirecting...', 'success');
            
            // Redirect to main page
            setTimeout(() => {
                window.location.href = '/main';
            }, 0);
        } else {
            // Handle specific error cases
            const response = { status: result.status };
            const data = result.error;
            if (response.status === 401) {
                showFieldError('username', 'Invalid username or password');
                showFieldError('password', 'Invalid username or password');
            } else if (response.status === 400) {
                showStatus(data.message || 'Invalid request data', 'error');
            } else {
                showStatus('Login failed. Please try again.', 'error');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        showStatus('Network error. Please check your connection.', 'error');
    }
    
    button.classList.remove('loading');
    button.textContent = 'Sign In';
    button.disabled = false;
});

// Clear errors when user starts typing
document.querySelectorAll('input, select').forEach(input => {
    input.addEventListener('input', function() {
        hideFieldError(this.id);
    });
});
