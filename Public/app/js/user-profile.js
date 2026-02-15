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
    
    // Trigger animation after display is set (double RAF ensures transition works)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });
    
    body.innerHTML = '<div class="user-profile-loading">Loading profile...</div>';
    
    try {
        // Fetch current user info
        const userPrivateInfo = await apiGetCurrentUser();
        console.log('Current user data received:', userPrivateInfo);
        
        // Update currentUser in localStorage with latest info including photos
        if (currentUser && userPrivateInfo.info) {
            currentUser.info = userPrivateInfo.info;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            // Update sidebar avatar display
            updateCurrentUserButton();
        }
        
        displayCurrentUserProfile();
    } catch (error) {
        console.error('Error fetching current user info:', error);
        body.innerHTML = `<div class="user-profile-error">Error loading profile: ${error.message}</div>`;
    }

    // Close on backdrop click
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeCurrentUserProfile();
        }
    });
}

function displayCurrentUserProfile() {
    if (!currentUser || !currentUser.info) {
        console.error('Cannot display profile: currentUser is not set');
        return;
    }

    const body = document.getElementById('userProfileBody');
    
    const user = currentUser.info;
    const name = user.name || user.username || 'Unknown User';
    const avatarColor = getAvatarColorForUser(user.id);
    const username = user.username || 'unknown';
    const about = user.about || '';
    
    // Store photos globally
    userPhotos = user.photos || [];
    
    // Adjust current index if needed (after deletion)
    if (currentPhotoIndex >= userPhotos.length && userPhotos.length > 0) {
        currentPhotoIndex = userPhotos.length - 1;
    } else if (userPhotos.length === 0) {
        currentPhotoIndex = 0;
    }
    
    // Get current photo
    const currentPhoto = userPhotos.length > 0 ? userPhotos[currentPhotoIndex] : null;
    const photoUrl = currentPhoto ? getUploadUrl(currentPhoto.id, currentPhoto.fileType) : null;
    const hasMultiplePhotos = userPhotos.length > 1;
    
    let html = `
        <div class="user-profile-avatar-container">
            <div class="user-profile-avatar-wrapper" id="userProfileAvatarWrapper">
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-left" onclick="event.stopPropagation(); navigateAvatarPhoto(-1)" title="Previous photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m15 18-6-6 6-6"></path>
                    </svg>
                </button>
                ` : ''}
                <div class="user-profile-avatar" id="userProfileAvatar" style="cursor: pointer;">
                    ${photoUrl ? `<img src="${photoUrl}" alt="" id="userProfileAvatarImg">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(name)}</span>`}
                </div>
                <svg class="user-profile-avatar-progress" id="userProfileAvatarProgress" viewBox="0 0 100 100" style="display: none;">
                    <circle class="user-profile-avatar-progress-bg" cx="50" cy="50" r="48"></circle>
                    <circle class="user-profile-avatar-progress-bar" cx="50" cy="50" r="48" id="userProfileAvatarProgressBar"></circle>
                </svg>
                <button class="ellipsis-button" id="userProfileAvatarMenuButton" onclick="event.stopPropagation(); showAvatarMenu(event)" title="Avatar menu">
                    •••
                </button>
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-right" onclick="event.stopPropagation(); navigateAvatarPhoto(1)" title="Next photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </button>
                ` : ''}
            </div>
            ${hasMultiplePhotos ? `
            <div class="user-profile-avatar-pagination">
                ${userPhotos.map((photo, index) => `
                    <button class="user-profile-avatar-pagination-dot ${index === currentPhotoIndex ? 'active' : ''}" 
                            onclick="event.stopPropagation(); switchAvatarPhoto(${index})" 
                            title="Photo ${index + 1}"></button>
                `).join('')}
            </div>
            ` : ''}
            <input type="file" id="userProfileAvatarInput" accept="image/*" style="display: none;" onchange="handleAvatarFileSelect(event)">
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
        </div>
    `;
    
    body.innerHTML = html;
    
    // Add click handler to avatar after HTML is inserted
    const avatar = document.getElementById('userProfileAvatar');
    
    if (avatar) {
        avatar.addEventListener('click', function(event) {
            // Don't open viewer if clicking on menu or chevrons
            if (event.target.closest('.user-profile-avatar-menu-button') || 
                event.target.closest('.user-profile-avatar-chevron')) {
                return;
            }
            if (photoUrl) {
                openAvatarViewer();
            } else {
                openAvatarFileDialog();
            }
        });
    }
    
    // Setup keyboard navigation
    setupAvatarKeyboardNavigation();
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
        await apiUpdateCurrentUser(name, about);
        
        // Update currentUser in localStorage
        if (currentUser && currentUser.info) {
            currentUser.info.name = name || null;
            currentUser.info.about = about || null;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        
        // Update display
        updateCurrentUserButton();
        
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

function showUserProfileMenu() {
    const menuButton = document.getElementById('userProfileMenuButton');
    if (!menuButton) return;
    
    const rect = menuButton.getBoundingClientRect();
    
    const menuItems = [
        { id: 'change_password', label: 'Change Password', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
        { id: 'logout', label: 'Logout', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" x2="9" y1="12" y2="12"></line></svg>', separator: true }
    ];
    
    showContextMenu({
        items: menuItems,
        x: rect.left,
        y: rect.bottom + 2,
        anchor: 'top-left',
        onAction: (action) => {
            handleUserProfileMenuAction(action);
        }
    });
}

function handleUserProfileMenuAction(action) {
    switch (action) {
        case 'change_password':
            showChangePasswordModal();
            break;
        case 'logout':
            logout();
            break;
    }
}

function showChangePasswordModal() {
    // Create a new modal container similar to user profile modal (slides from left)
    const modalId = 'changePasswordModal';
    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'user-profile-modal';
    modalElement.style.zIndex = 1010 + userInfoModalStack.length * 10;
    
    modalElement.innerHTML = `
        <div class="user-profile-content">
            <div class="user-profile-header">
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="user-panel-close-btn" onclick="closeTopModalInfoPanel()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x">
                        <path d="M18 6 6 18"></path>
                        <path d="m6 6 12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="user-profile-body" id="${modalId}_body">
                <div class="change-password-form">
                    <div class="form-group">
                        <label for="currentPasswordInput">Current Password</label>
                        <input type="password" id="currentPasswordInput" placeholder="Enter current password">
                    </div>
                    <div class="form-group">
                        <label for="newPasswordInput">New Password</label>
                        <input type="password" id="newPasswordInput" placeholder="Enter new password">
                    </div>
                    <div class="form-group">
                        <label for="confirmPasswordInput">Confirm New Password</label>
                        <input type="password" id="confirmPasswordInput" placeholder="Confirm new password">
                    </div>
                    <div id="passwordChangeError" class="user-profile-error" style="display: none; margin-top: 1rem;"></div>
                    <div id="passwordChangeSuccess" class="user-profile-success" style="display: none; margin-top: 1rem;"></div>
                    <div class="user-profile-actions">
                        <button class="user-profile-save-btn" onclick="handleChangePassword()" id="changePasswordBtn">Change Password</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalElement);
    
    // Close on backdrop click
    modalElement.addEventListener('click', function(event) {
        if (event.target === modalElement) {
            closeTopModalInfoPanel();
        }
    });
    
    // Show modal
    modalElement.style.display = 'block';
    modalElement.offsetHeight;
    
    // Trigger animation after display is set (double RAF ensures transition works)
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });
    });
    
    // Add to stack
    userInfoModalStack.push({ type: 'changePassword', element: modalElement, bodyId: `${modalId}_body` });
    
    // Focus on first input
    setTimeout(() => {
        const currentPasswordInput = document.getElementById('currentPasswordInput');
        if (currentPasswordInput) {
            currentPasswordInput.focus();
        }
    }, 100);
    
    // Handle Enter key on inputs
    const inputs = ['currentPasswordInput', 'newPasswordInput', 'confirmPasswordInput'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleChangePassword();
                }
            });
        }
    });
}

async function handleChangePassword() {
    const currentPasswordInput = document.getElementById('currentPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmPasswordInput = document.getElementById('confirmPasswordInput');
    const errorDiv = document.getElementById('passwordChangeError');
    const successDiv = document.getElementById('passwordChangeSuccess');
    const changeBtn = document.getElementById('changePasswordBtn');
    
    // Hide previous messages
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Validation
    if (!currentPassword) {
        errorDiv.textContent = 'Please enter your current password';
        errorDiv.style.display = 'block';
        currentPasswordInput.focus();
        return;
    }
    
    if (!newPassword) {
        errorDiv.textContent = 'Please enter a new password';
        errorDiv.style.display = 'block';
        newPasswordInput.focus();
        return;
    }
    
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters long';
        errorDiv.style.display = 'block';
        newPasswordInput.focus();
        return;
    }
    
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Passwords do not match';
        errorDiv.style.display = 'block';
        confirmPasswordInput.focus();
        return;
    }
    
    if (currentPassword === newPassword) {
        errorDiv.textContent = 'New password must be different from current password';
        errorDiv.style.display = 'block';
        newPasswordInput.focus();
        return;
    }
    
    // Disable button during request
    changeBtn.disabled = true;
    changeBtn.textContent = 'Changing...';
    
    try {
        await apiChangePassword(currentPassword, newPassword);
        
        // Show success message
        successDiv.textContent = 'Password changed successfully';
        successDiv.style.display = 'block';
        
        // Close modal after 1 second
        setTimeout(() => {
            closeTopModalInfoPanel();
        }, 500);
        
    } catch (error) {
        console.error('Error changing password:', error);
        errorDiv.textContent = error.message || 'Failed to change password';
        errorDiv.style.display = 'block';
        
        // Re-enable button
        changeBtn.disabled = false;
        changeBtn.textContent = 'Change Password';
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

// Avatar upload functionality
let avatarUploadInProgress = false;
let avatarUploadRetryHandler = null;
let currentPhotoIndex = 0; // Track current photo index
let userPhotos = []; // Store all user photos

function openAvatarFileDialog() {
    if (avatarUploadInProgress) return;
    const input = document.getElementById('userProfileAvatarInput');
    if (input) {
        input.click();
    }
}

function handleAvatarFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Check file size (1MB = 1,048,576 bytes)
    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('Image size must be less than 1MB');
        return;
    }
    
    // Show preview immediately
    const avatar = document.getElementById('userProfileAvatar');
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Avatar preview';
        img.id = 'userProfileAvatarImg';
        avatar.innerHTML = '';
        avatar.appendChild(img);
    };
    reader.readAsDataURL(file);
    
    // Start upload
    uploadAvatarFile(file);
    
    // Reset input
    event.target.value = '';
}

async function uploadAvatarFile(file) {
    if (avatarUploadInProgress) return;
    
    avatarUploadInProgress = true;
    const progressBar = document.getElementById('userProfileAvatarProgress');
    const progressCircle = document.getElementById('userProfileAvatarProgressBar');
    const avatar = document.getElementById('userProfileAvatar');
    
    // Show progress bar
    progressBar.style.display = 'block';
    avatar.style.opacity = '0.7';
    
    let currentProgress = 0;
    let animationFrameId = null;
    
    // Helper function to update progress visually
    const updateProgressVisual = (progress) => {
        const circumference = 2 * Math.PI * 48;
        const offset = circumference - (progress / 100) * circumference;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = offset;
    };
    
    // Smooth animation function for the last 25%
    const animateToComplete = (startProgress, duration) => {
        const startTime = Date.now();
        const endProgress = 100;
        const progressRange = endProgress - startProgress;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(1, elapsed / duration);
            
            // Use ease-out easing for smooth animation
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentProgressValue = startProgress + (progressRange * easedProgress);
            
            console.log(`Animation progress: ${currentProgressValue.toFixed(2)}%`);
            updateProgressVisual(currentProgressValue);
            
            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                console.log(`Animation complete: 100%`);
            }
        };
        
        animate();
    };
    
    try {
        // Generate UUID for file name (without extension - server will add it)
        const fileId = crypto.randomUUID();
        const fileExtension = file.name.split('.').pop().toLowerCase() || 'jpg';
        
        // Upload file using streaming upload
        const uploadedFileName = await apiUploadFile(file, fileId, file.type, (progress) => {
            // Cap progress at 75% during real upload
            currentProgress = Math.min(progress, 75);
            console.log(`Upload progress: ${progress.toFixed(2)}% (capped at ${currentProgress.toFixed(2)}%)`);
            updateProgressVisual(currentProgress);
        });
        
        // Extract file ID from uploaded file name (remove extension)
        // Server returns filename like "uuid.jpg", we need just "uuid"
        const uploadedFileId = uploadedFileName.split('.').slice(0, -1).join('.');
        
        // Always animate the last 25% (from 75% to 100%) smoothly over 1/2 second
        const animationDuration = 500; // ms
        const startProgress = 75;
        
        console.log(`Upload complete. Starting animation from ${startProgress}% to 100% over ${animationDuration}ms`);
        // Start smooth animation from 75% to 100%
        animateToComplete(startProgress, animationDuration);
        
        // Wait for animation to complete
        await new Promise(resolve => {
            setTimeout(() => {
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                }
                updateProgressVisual(100);
                resolve();
            }, animationDuration);
        });
        
        // Add photo to user profile
        const updatedUserInfo = await apiAddUserPhoto(uploadedFileId, fileExtension, file.size);
        
        // Update local current user with the response
        if (currentUser) {
            currentUser.info = updatedUserInfo;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }
        
        updateCurrentUserButton();
        
        // Display profile again to refresh avatar and photos
        currentPhotoIndex = 0;
        displayCurrentUserProfile();
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        
        // Cancel any ongoing animation
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        // Show error with retry button
        showAvatarUploadError(error.message);
        
        // Store retry handler
        avatarUploadRetryHandler = () => uploadAvatarFile(file);
    } finally {
        avatarUploadInProgress = false;
        progressBar.style.display = 'none';
        avatar.style.opacity = '1';
    }
}

function showAvatarUploadError(errorMessage) {
    const avatarContainer = document.querySelector('.user-profile-avatar-container');
    if (!avatarContainer) return;
    
    // Remove existing error if any
    const existingError = avatarContainer.querySelector('.user-profile-avatar-error');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'user-profile-avatar-error';
    errorDiv.innerHTML = `
        <div class="user-profile-avatar-error-message">${escapeHtml(errorMessage)}</div>
        <button class="user-profile-avatar-retry-btn" onclick="retryAvatarUpload()">Retry</button>
    `;
    avatarContainer.appendChild(errorDiv);
}

function retryAvatarUpload() {
    // Remove error message
    const errorDiv = document.querySelector('.user-profile-avatar-error');
    if (errorDiv) {
        errorDiv.remove();
    }
    
    // Retry upload if handler exists
    if (avatarUploadRetryHandler) {
        avatarUploadRetryHandler();
        avatarUploadRetryHandler = null;
    }
}

function showAvatarMenu(event) {
    const menuButton = document.getElementById('userProfileAvatarMenuButton');
    const rect = menuButton.getBoundingClientRect();
    
    const menuItems = [
        { id: 'upload', label: 'Upload', icon: uploadIcon }
    ];
    
    // Add delete option if there are photos
    if (userPhotos.length > 0) {
        menuItems.push({ id: 'delete', label: 'Delete', icon: trashIcon, separator: true });
    }
    
    showContextMenu({
        items: menuItems,
        x: rect.left,
        y: rect.bottom + 5,
        onAction: (action) => {
            if (action === 'upload') {
                openAvatarFileDialog();
            } else if (action === 'delete') {
                const currentPhoto = userPhotos[currentPhotoIndex];
                if (currentPhoto) {
                    deleteUserAvatar(currentPhoto.id);
                }
            }
        }
    });
}

function navigateAvatarPhoto(direction) {
    if (userPhotos.length <= 1) return;
    
    currentPhotoIndex += direction;
    if (currentPhotoIndex < 0) {
        currentPhotoIndex = userPhotos.length - 1;
    } else if (currentPhotoIndex >= userPhotos.length) {
        currentPhotoIndex = 0;
    }
    
    updateAvatarDisplay();
}

function switchAvatarPhoto(index) {
    if (index < 0 || index >= userPhotos.length) return;
    currentPhotoIndex = index;
    updateAvatarDisplay();
}

function updateAvatarDisplay() {
    const avatar = document.getElementById('userProfileAvatar');
    const avatarImg = document.getElementById('userProfileAvatarImg');
    const currentPhoto = userPhotos[currentPhotoIndex];
    
    if (!avatar) return;
    
    if (currentPhoto && avatarImg) {
        avatarImg.src = getUploadUrl(currentPhoto.id, currentPhoto.fileType);
    } else if (currentPhoto) {
        const img = document.createElement('img');
        img.src = getUploadUrl(currentPhoto.id, currentPhoto.fileType);
        img.alt = '';
        img.id = 'userProfileAvatarImg';
        avatar.innerHTML = '';
        avatar.appendChild(img);
    }
    
    // Update pagination dots
    const container = document.querySelector('.user-profile-avatar-container');
    if (container) {
        const dots = container.querySelectorAll('.user-profile-avatar-pagination-dot');
        dots.forEach((dot, index) => {
            if (index === currentPhotoIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }
    
}

function openAvatarViewer() {
    if (userPhotos.length === 0) return;
    
    openMediaViewer(userPhotos, currentPhotoIndex, (newIndex) => {
        currentPhotoIndex = newIndex;
        updateAvatarDisplay();
    });
}

function setupAvatarKeyboardNavigation() {
    // Keyboard navigation is handled in the viewer
    // This function can be extended for other keyboard shortcuts if needed
}

async function deleteUserAvatar(photoId) {
    if (!photoId) return;
    
    if (!confirm('Are you sure you want to delete this photo?')) {
        return;
    }
    
    const deletedIndex = userPhotos.findIndex(p => p.id === photoId);
    
    try {
        await apiDeleteUserPhoto(photoId);
        
        // Adjust current index if needed
        if (deletedIndex < currentPhotoIndex) {
            currentPhotoIndex--;
        } else if (deletedIndex === currentPhotoIndex && currentPhotoIndex >= userPhotos.length - 1) {
            currentPhotoIndex = Math.max(0, userPhotos.length - 2);
        }
        
        // Reload profile to show updated avatar
        await openCurrentUserProfile();
        
    } catch (error) {
        console.error('Error deleting avatar:', error);
        alert('Error deleting avatar: ' + error.message);
    }
}
