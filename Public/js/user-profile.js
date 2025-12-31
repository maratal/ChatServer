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
        
        // Update currentUser in localStorage with latest info including photos
        if (currentUser && userPrivateInfo.info) {
            currentUser.info = userPrivateInfo.info;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            // Update sidebar avatar display
            updateCurrentUserDisplay();
        }
        
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
    const photoUrl = currentPhoto ? `/files/${currentPhoto.id}.${currentPhoto.fileType}` : null;
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
                    ${photoUrl ? `<img src="${photoUrl}" alt="" id="userProfileAvatarImg">` : initials}
                </div>
                <svg class="user-profile-avatar-progress" id="userProfileAvatarProgress" viewBox="0 0 100 100" style="display: none;">
                    <circle class="user-profile-avatar-progress-bg" cx="50" cy="50" r="48"></circle>
                    <circle class="user-profile-avatar-progress-bar" cx="50" cy="50" r="48" id="userProfileAvatarProgressBar"></circle>
                </svg>
                <button class="user-profile-avatar-menu" id="userProfileAvatarMenu" onclick="event.stopPropagation(); toggleAvatarMenu()" title="Avatar menu">
                    •••
                </button>
                <div class="user-profile-avatar-menu-dropdown" id="userProfileAvatarMenuDropdown" style="display: none;">
                    <button class="user-profile-avatar-menu-item" onclick="event.stopPropagation(); closeAvatarMenu(); openAvatarFileDialog();">Upload</button>
                    ${userPhotos.length > 0 ? `
                    <div class="user-profile-avatar-menu-divider"></div>
                    <button class="user-profile-avatar-menu-item user-profile-avatar-menu-item-danger" onclick="event.stopPropagation(); closeAvatarMenu(); deleteUserAvatar('${currentPhoto ? currentPhoto.id : ''}');">Remove</button>
                    ` : ''}
                </div>
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
            <button class="user-profile-logout-btn" onclick="logout()">
                Logout
                <svg class="user-profile-logout-icon" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 14H3C2.46957 14 1.96086 13.7893 1.58579 13.4142C1.21071 13.0391 1 12.5304 1 12V4C1 3.46957 1.21071 2.96086 1.58579 2.58579C1.96086 2.21071 2.46957 2 3 2H6M10 11L14 8M14 8L10 5M14 8H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
    `;
    
    body.innerHTML = html;
    
    // Add click handler to avatar after HTML is inserted
    const avatar = document.getElementById('userProfileAvatar');
    const wrapper = document.getElementById('userProfileAvatarWrapper');
    const menu = document.getElementById('userProfileAvatarMenu');
    
    if (avatar) {
        avatar.addEventListener('click', function(event) {
            // Don't open viewer if clicking on menu or chevrons
            if (event.target.closest('.user-profile-avatar-menu') || 
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
    
    // Hide menu when mouse leaves wrapper
    if (wrapper && menu) {
        wrapper.addEventListener('mouseleave', () => {
            closeAvatarMenu();
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
    // Don't close profile panel if viewer is open
    const viewer = document.getElementById('mediaViewer');
    if (viewer && (viewer === event.target || viewer.contains(event.target))) {
        return;
    }
    const modal = document.getElementById('userProfileModal');
    const content = document.querySelector('.user-profile-content');
    if (modal && modal.classList.contains('show') && content && !content.contains(event.target) && !event.target.closest('#sidebarCurrentUserAvatar')) {
        closeCurrentUserProfile();
    }
}, true);

// Close profile modal on Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Don't close profile panel if viewer is open
        const viewer = document.getElementById('mediaViewer');
        if (viewer) {
            return; // Viewer will handle Escape key
        }
        const modal = document.getElementById('userProfileModal');
        if (modal && modal.classList.contains('show')) {
            closeCurrentUserProfile();
        }
    }
}, true); // Use capture phase

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
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('No access token available');
        }
        
        const uploadUrl = `/uploads`;
        const response = await uploadFileWithProgress(uploadUrl, file, fileId, file.type, (progress) => {
            // Cap progress at 75% during real upload
            currentProgress = Math.min(progress, 75);
            console.log(`Upload progress: ${progress.toFixed(2)}% (capped at ${currentProgress.toFixed(2)}%)`);
            updateProgressVisual(currentProgress);
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} ${errorText}`);
        }
        
        const uploadedFileName = await response.text();
        
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
        const addPhotoResponse = await fetch('/users/me/photos', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                photo: {
                    id: uploadedFileId,
                    fileType: fileExtension,
                    fileSize: file.size
                }
            })
        });
        
        if (!addPhotoResponse.ok) {
            const errorText = await addPhotoResponse.text();
            throw new Error(`Failed to add photo: ${addPhotoResponse.status} ${errorText}`);
        }
        
        // Reload profile to show updated avatar
        // Set index to last photo (newly uploaded)
        const reloadedUser = await fetch('/users/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        }).then(r => r.json());
        
        currentPhotoIndex = 0;
        
        await openCurrentUserProfile();
        
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

function uploadFileWithProgress(url, file, fileName, contentType, onProgress) {
    return new Promise((resolve, reject) => {
        const accessToken = getAccessToken();
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve({
                    ok: true,
                    text: () => Promise.resolve(xhr.responseText)
                });
            } else {
                reject(new Error(`Upload failed with status ${xhr.status}`));
            }
        });
        
        xhr.addEventListener('error', () => {
            reject(new Error('Upload failed'));
        });
        
        xhr.addEventListener('abort', () => {
            reject(new Error('Upload aborted'));
        });
        
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('File-Name', fileName);
        xhr.setRequestHeader('Content-Type', contentType);
        
        xhr.send(file);
    });
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

function toggleAvatarMenu() {
    const menu = document.getElementById('userProfileAvatarMenuDropdown');
    if (menu) {
        const isVisible = menu.style.display !== 'none';
        menu.style.display = isVisible ? 'none' : 'block';
    }
}

function closeAvatarMenu() {
    const menu = document.getElementById('userProfileAvatarMenuDropdown');
    if (menu) {
        menu.style.display = 'none';
    }
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
        avatarImg.src = `/files/${currentPhoto.id}.${currentPhoto.fileType}`;
    } else if (currentPhoto) {
        const img = document.createElement('img');
        img.src = `/files/${currentPhoto.id}.${currentPhoto.fileType}`;
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
    
    // Update menu remove button
    const menuRemoveBtn = document.querySelector('.user-profile-avatar-menu-item-danger');
    if (menuRemoveBtn && currentPhoto) {
        menuRemoveBtn.setAttribute('onclick', `event.stopPropagation(); closeAvatarMenu(); deleteUserAvatar('${currentPhoto.id}');`);
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
        const accessToken = getAccessToken();
        if (!accessToken) {
            throw new Error('No access token available');
        }
        
        const response = await fetch(`/users/me/photos/${photoId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to delete photo: ${response.status} ${errorText}`);
        }
        
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
