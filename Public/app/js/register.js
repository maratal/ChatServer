// Generate a unique device ID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Centralized registration function
async function performRegistration(name, username, password, deviceInfo) {
    const response = await fetch('/users', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: name,
            username: username,
            password: password,
            deviceInfo: deviceInfo
        })
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

// Validate password strength
function validatePassword(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password)
    };
    
    const isValid = Object.values(requirements).every(req => req);
    return { isValid, requirements };
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
document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Clear previous errors
    document.querySelectorAll('.form-group.error').forEach(group => {
        group.classList.remove('error');
    });
    
    const button = document.querySelector('.register-button');
    button.classList.add('loading');
    button.textContent = 'Creating Account...';
    button.disabled = true;
    
    const formData = {
        name: document.getElementById('name').value.trim(),
        username: document.getElementById('username').value.trim(),
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        deviceInfo: getDeviceInfo()
    };
    
    // Validation
    let hasErrors = false;
    
    if (!formData.name) {
        showFieldError('name', 'Full name is required');
        hasErrors = true;
    }
    
    if (!formData.username) {
        showFieldError('username', 'Username is required');
        hasErrors = true;
    } else if (formData.username.length < 3) {
        showFieldError('username', 'Username must be at least 3 characters');
        hasErrors = true;
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        showFieldError('username', 'Username can only contain letters, numbers, and underscores');
        hasErrors = true;
    }
    
    if (!formData.password) {
        showFieldError('password', 'Password is required');
        hasErrors = true;
    } else {
        const passwordValidation = validatePassword(formData.password);
        if (!passwordValidation.isValid) {
            const missing = [];
            if (!passwordValidation.requirements.length) missing.push('at least 8 characters');
            if (!passwordValidation.requirements.uppercase) missing.push('uppercase letter');
            if (!passwordValidation.requirements.lowercase) missing.push('lowercase letter');
            if (!passwordValidation.requirements.number) missing.push('number');
            
            showFieldError('password', `Password must contain: ${missing.join(', ')}`);
            hasErrors = true;
        }
    }
    
    if (!formData.confirmPassword) {
        showFieldError('confirmPassword', 'Please confirm your password');
        hasErrors = true;
    } else if (formData.password !== formData.confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match');
        hasErrors = true;
    }
    
    if (hasErrors) {
        button.classList.remove('loading');
        button.textContent = 'Create Account';
        button.disabled = false;
        return;
    }
    
    try {
        const result = await performRegistration(formData.name, formData.username, formData.password, formData.deviceInfo);
        
        if (result.success) {
            showStatus('Account created successfully! Redirecting...', 'success');
            
            // Redirect to main page
            setTimeout(() => {
                window.location.href = '/main';
            }, 0);
        } else {
            // Handle specific error cases
            const response = { status: result.status };
            const data = result.error;
            if (response.status === 409) {
                showFieldError('username', 'Username already exists');
            } else if (response.status === 400) {
                const errorMsg = data.message || 'Invalid registration data';
                if (errorMsg.toLowerCase().includes('username')) {
                    showFieldError('username', errorMsg);
                } else if (errorMsg.toLowerCase().includes('password')) {
                    showFieldError('password', errorMsg);
                } else {
                    showStatus(errorMsg, 'error');
                }
            } else {
                showStatus('Registration failed. Please try again.', 'error');
            }
        }
    } catch (error) {
        console.error('Registration error:', error);
        showStatus('Network error. Please check your connection.', 'error');
    }
    
    button.classList.remove('loading');
    button.textContent = 'Create Account';
    button.disabled = false;
});

// Clear errors when user starts typing
document.querySelectorAll('input, textarea, select').forEach(input => {
    input.addEventListener('input', function() {
        hideFieldError(this.id);
    });
});

// Real-time password validation feedback
document.getElementById('password').addEventListener('input', function() {
    const password = this.value;
    const validation = validatePassword(password);
    
    if (password && !validation.isValid) {
        const requirements = document.querySelector('.password-requirements-tooltip');
        const items = requirements.querySelectorAll('li');
        
        items[0].style.color = validation.requirements.length ? '#28a745' : '#dc3545';
        items[1].style.color = validation.requirements.uppercase ? '#28a745' : '#dc3545';
        items[2].style.color = validation.requirements.lowercase ? '#28a745' : '#dc3545';
        items[3].style.color = validation.requirements.number ? '#28a745' : '#dc3545';
    } else {
        // Reset colors
        const items = document.querySelectorAll('.password-requirements-tooltip li');
        items.forEach(item => item.style.color = '');
    }
});

// Real-time confirm password validation
document.getElementById('confirmPassword').addEventListener('input', function() {
    const password = document.getElementById('password').value;
    const confirmPassword = this.value;
    
    if (confirmPassword && password !== confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match');
    } else {
        hideFieldError('confirmPassword');
    }
});
