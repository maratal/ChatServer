// Current User Profile Functions

async function openCurrentUserProfile() {
    if (!currentUser || !currentUser.info || !currentUser.info.id) {
        console.error('Cannot open profile: currentUser is not set');
        return;
    }
    
    const modal = document.getElementById('userProfileModal');
    const body = document.getElementById('userProfileBody');
    
    // Show modal - slide from left
    modal.style.display = 'block';
    // Force a reflow to ensure initial styles are applied
    modal.offsetHeight;
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });
    
    body.innerHTML = '<div class="user-profile-loading">Loading profile...</div>';
    
    try {
        // Fetch current user info
        const accessToken = getAccessToken();
        const response = await fetch('/users/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch current user info:', response.status, errorText);
            throw new Error(`Failed to fetch user info: ${response.status} ${errorText}`);
        }
        
        const userPrivateInfo = await response.json();
        console.log('Current user data received:', userPrivateInfo);
        displayCurrentUserProfile(userPrivateInfo.info);
    } catch (error) {
        console.error('Error fetching current user info:', error);
        body.innerHTML = `<div class="user-profile-error">Error loading profile: ${error.message}</div>`;
    }
}

function displayCurrentUserProfile(user) {
    const body = document.getElementById('userProfileBody');
    
    const initials = getInitials(user.name || user.username || '?');
    const name = user.name || user.username || 'Unknown User';
    const username = user.username || 'unknown';
    const about = user.about || '';
    
    // Get user photo if available
    const photoUrl = user.photos && user.photos.length > 0 
        ? `/files/${user.photos[0].id}` 
        : null;
    
    let html = `
        <div class="user-profile-avatar-container">
            <div class="user-profile-avatar">
                ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(name)}">` : initials}
            </div>
        </div>
        <div class="user-profile-section">
            <div class="user-profile-section-title">Name</div>
            <input type="text" class="user-profile-name-input" id="userProfileNameInput" value="${escapeHtml(name)}" placeholder="Enter your name">
        </div>
        <div class="user-profile-section">
            <div class="user-profile-section-title">Username</div>
            <div class="user-profile-username">@${escapeHtml(username)}</div>
        </div>
        <div class="user-profile-section">
            <div class="user-profile-section-title">About</div>
            <textarea class="user-profile-about-input" id="userProfileAboutInput" placeholder="Tell us about yourself">${escapeHtml(about)}</textarea>
        </div>
        <div class="user-profile-actions">
            <button class="user-profile-save-btn" onclick="saveCurrentUserProfile()">Save Changes</button>
            <button class="user-profile-logout-btn" onclick="logout()">
                Logout
                <svg class="user-profile-logout-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 14H3C2.46957 14 1.96086 13.7893 1.58579 13.4142C1.21071 13.0391 1 12.5304 1 12V4C1 3.46957 1.21071 2.96086 1.58579 2.58579C1.96086 2.21071 2.46957 2 3 2H6M10 11L14 8M14 8L10 5M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `;
    
    body.innerHTML = html;
}

async function saveCurrentUserProfile() {
    const nameInput = document.getElementById('userProfileNameInput');
    const aboutInput = document.getElementById('userProfileAboutInput');
    
    if (!nameInput || !aboutInput) {
        console.error('Profile inputs not found');
        return;
    }
    
    const name = nameInput.value.trim();
    const about = aboutInput.value.trim();
    
    try {
        const accessToken = getAccessToken();
        const response = await fetch('/users/me', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name || null,
                about: about || null
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to update profile:', response.status, errorText);
            alert('Failed to update profile: ' + errorText);
            return;
        }
        
        // Update currentUser in localStorage
        if (currentUser && currentUser.info) {
            currentUser.info.name = name || null;
            currentUser.info.about = about || null;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        
        // Update display
        updateCurrentUserDisplay();
        
        // Reload profile to show updated data
        await openCurrentUserProfile();
        
        // Show success message
        const body = document.getElementById('userProfileBody');
        const successMsg = document.createElement('div');
        successMsg.className = 'user-profile-success';
        successMsg.textContent = 'Profile updated successfully!';
        body.insertBefore(successMsg, body.firstChild);
        
        setTimeout(() => {
            successMsg.remove();
        }, 2000);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
    }
}

function closeCurrentUserProfile() {
    const modal = document.getElementById('userProfileModal');
    modal.classList.remove('show');
    // Hide modal after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Close profile modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('userProfileModal');
    const content = document.querySelector('.user-profile-content');
    if (modal && modal.classList.contains('show') && content && !content.contains(event.target) && !event.target.closest('#sidebarCurrentUserAvatar')) {
        closeCurrentUserProfile();
    }
}, true);

// Close profile modal on Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modal = document.getElementById('userProfileModal');
        if (modal && modal.classList.contains('show')) {
            closeCurrentUserProfile();
        }
    }
});

