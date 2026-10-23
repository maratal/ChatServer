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
    const photoUrl = currentPhoto ? getPreviewUrl(currentPhoto.id, currentPhoto.fileType) : null;
    const hasMultiplePhotos = userPhotos.length > 1;
    
    let html = `
        <div class="user-profile-avatar-container">
            <div class="user-profile-avatar-wrapper" id="userProfileAvatarWrapper">
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-left" onclick="event.stopPropagation(); navigateAvatarPhoto(-1)" title="Previous photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m14 18-6-6 6-6"></path>
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
                        <path d="m10 18 6-6-6-6"></path>
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
            <div class="group-name-input-container">
                <input type="text" class="user-profile-name-input" id="userProfileNameInput" value="${escapeHtml(name)}" placeholder="Enter your name" data-original-value="${escapeHtml(name)}">
                ${saveBtnHTML('userProfileNameSaveBtn', 'saveCurrentUserName()')}
            </div>
        </div>
        <div class="user-profile-section">
            <div class="user-profile-section-title">About</div>
            <div class="group-name-input-container" style="align-items: flex-start;">
                <textarea class="user-profile-about-input" id="userProfileAboutInput" placeholder="Tell us about yourself" data-original-value="${escapeHtml(about)}">${escapeHtml(about)}</textarea>
                ${saveBtnHTML('userProfileAboutSaveBtn', 'saveCurrentUserAbout()')}
            </div>
        </div>
        <div class="user-profile-section">
            <div class="user-profile-section-title">Information</div>
            <div class="user-info-meta">
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>User ID: <a href="/${user.id}" class="info-link" target="_blank" rel="noopener noreferrer">${user.id}</a></span>
                </div>
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                        <path d="M2 12h20"></path>
                    </svg>
                    <span>Username: <a href="/${encodeURIComponent(username)}" class="info-link" target="_blank" rel="noopener noreferrer">${escapeHtml(username)}</a></span>
                </div>
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span>Registered: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
    
    body.innerHTML = html;
    
    // Add input change listeners for name and about
    const nameInput = document.getElementById('userProfileNameInput');
    const nameSaveBtn = document.getElementById('userProfileNameSaveBtn');
    if (nameInput && nameSaveBtn) {
        nameInput.addEventListener('input', function() {
            const originalValue = this.getAttribute('data-original-value') || '';
            nameSaveBtn.style.display = this.value.trim() !== originalValue ? 'flex' : 'none';
        });
        nameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && nameSaveBtn.style.display !== 'none') {
                e.preventDefault();
                saveCurrentUserName();
            }
        });
    }

    const aboutInput = document.getElementById('userProfileAboutInput');
    const aboutSaveBtn = document.getElementById('userProfileAboutSaveBtn');
    if (aboutInput && aboutSaveBtn) {
        aboutInput.addEventListener('input', function() {
            const originalValue = this.getAttribute('data-original-value') || '';
            aboutSaveBtn.style.display = this.value.trim() !== originalValue ? 'flex' : 'none';
        });
        aboutInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && aboutSaveBtn.style.display !== 'none') {
                e.preventDefault();
                saveCurrentUserAbout();
            }
        });
    }

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

async function saveCurrentUserName() {
    const nameInput = document.getElementById('userProfileNameInput');
    const saveBtn = document.getElementById('userProfileNameSaveBtn');
    if (!nameInput || !saveBtn) return;

    const newName = nameInput.value.trim() || null;
    const originalValue = nameInput.getAttribute('data-original-value') || '';

    if ((newName || '') === originalValue) {
        saveBtn.style.display = 'none';
        return;
    }

    saveBtn.classList.remove('idle', 'success');
    saveBtn.classList.add('saving');
    saveBtn.disabled = true;

    try {
        await apiUpdateCurrentUser({ name: newName });

        if (currentUser && currentUser.info) {
            currentUser.info.name = newName || null;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }

        nameInput.setAttribute('data-original-value', newName || '');

        saveBtn.classList.remove('saving');
        saveBtn.classList.add('success');

        updateCurrentUserButton();

        setTimeout(() => {
            saveBtn.classList.add('hiding');
            setTimeout(() => {
                saveBtn.style.display = 'none';
                saveBtn.classList.remove('success', 'hiding');
                saveBtn.classList.add('idle');
                saveBtn.disabled = false;
            }, 300);
        }, 500);
    } catch (error) {
        console.error('Error saving name:', error);
        alert('Error saving name: ' + error.message);
        saveBtn.classList.remove('saving');
        saveBtn.disabled = false;
    }
}

async function saveCurrentUserAbout() {
    const aboutInput = document.getElementById('userProfileAboutInput');
    const saveBtn = document.getElementById('userProfileAboutSaveBtn');
    if (!aboutInput || !saveBtn) return;

    const newAbout = aboutInput.value.trim();
    const originalValue = aboutInput.getAttribute('data-original-value') || '';

    if (newAbout === originalValue) {
        saveBtn.style.display = 'none';
        return;
    }

    saveBtn.classList.remove('idle', 'success');
    saveBtn.classList.add('saving');
    saveBtn.disabled = true;

    try {
        await apiUpdateCurrentUser({ about: newAbout });

        if (currentUser && currentUser.info) {
            currentUser.info.about = newAbout;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
        }

        aboutInput.setAttribute('data-original-value', newAbout);

        saveBtn.classList.remove('saving');
        saveBtn.classList.add('success');

        setTimeout(() => {
            saveBtn.classList.add('hiding');
            setTimeout(() => {
                saveBtn.style.display = 'none';
                saveBtn.classList.remove('success', 'hiding');
                saveBtn.classList.add('idle');
                saveBtn.disabled = false;
            }, 300);
        }, 500);
    } catch (error) {
        console.error('Error saving about:', error);
        alert('Error saving about: ' + error.message);
        saveBtn.classList.remove('saving');
        saveBtn.disabled = false;
    }
}

function showUserProfileMenu() {
    const menuButton = document.getElementById('userProfileMenuButton');
    if (!menuButton) return;
    
    const rect = menuButton.getBoundingClientRect();
    
    const menuItems = [
        { id: 'change_password', label: 'Change Password', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>' },
        { id: 'change_security_question', label: 'Change Security Question', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2"></path><line x1="12" y1="17" x2="12" y2="17"></line></svg>' },
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
        case 'change_security_question':
            showSecurityQuestionModal();
            break;
        case 'logout':
            logout();
            break;
    }
}

// A hidden username field for the password forms in the profile. Without it, a password manager
// guesses which field holds the username and fills a saved login's username into the wrong one
// (such as the security question). With it, the saved login is matched to this account instead.
function hiddenUsernameField() {
    const username = (currentUser && currentUser.info && currentUser.info.username) || '';
    return `<input type="text" name="username" autocomplete="username" value="${escapeHtml(username)}" readonly style="display: none;">`;
}

// Tells common password managers that a field is not part of a login.
const NOT_A_LOGIN_FIELD = 'autocomplete="off" data-lpignore="true" data-1p-ignore data-bwignore data-form-type="other"';

function showChangePasswordModal() {
    // Create a new modal container similar to user profile modal (slides from left)
    const modalId = 'changePasswordModal';
    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'user-profile-modal';
    modalElement.style.zIndex = 1010 + userInfoModalStack.length * 10;
    
    modalElement.innerHTML = `
        <div class="user-profile-content">
            <div class="modal-panel-header user-profile-header">
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="inline-button" onclick="closeTopModalInfoPanel()">
                    ${closeIcon}
                </button>
            </div>
            <div class="user-profile-body" id="${modalId}_body">
                <div class="change-password-form">
                    ${hiddenUsernameField()}
                    <div class="form-group">
                        <label for="currentPasswordInput">Current Password</label>
                        <input type="password" id="currentPasswordInput" placeholder="Enter current password" autocomplete="current-password">
                    </div>
                    <div class="form-group">
                        <label for="newPasswordInput">New Password</label>
                        <input type="password" id="newPasswordInput" placeholder="Enter new password" autocomplete="new-password">
                        <div class="field-hint">8-25 characters, with an uppercase letter, a lowercase letter and a digit.</div>
                    </div>
                    <div class="form-group">
                        <label for="confirmPasswordInput">Confirm New Password</label>
                        <input type="password" id="confirmPasswordInput" placeholder="Confirm new password" autocomplete="new-password">
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
    
    const problem = passwordProblem(newPassword);
    if (problem) {
        errorDiv.textContent = problem;
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

// The security question is what recovers the account when the password is lost.
// Changing it costs the current password, so a stolen session alone cannot take the account over.
async function showSecurityQuestionModal() {
    const modalId = 'securityQuestionModal';
    const modalElement = document.createElement('div');
    modalElement.id = modalId;
    modalElement.className = 'user-profile-modal';
    modalElement.style.zIndex = 1010 + userInfoModalStack.length * 10;
    
    modalElement.innerHTML = `
        <div class="user-profile-content">
            <div class="modal-panel-header user-profile-header">
                <h1 class="text-2xl font-bold text-sidebar-foreground"></h1>
                <button class="inline-button" onclick="closeTopModalInfoPanel()">
                    ${closeIcon}
                </button>
            </div>
            <div class="user-profile-body" id="${modalId}_body">
                <div class="change-password-form">
                    ${hiddenUsernameField()}
                    <div class="form-group">
                        <label for="securityPasswordInput">Current Password</label>
                        <input type="password" id="securityPasswordInput" placeholder="Enter current password" autocomplete="current-password">
                    </div>
                    <div class="form-group">
                        <label for="securityQuestionInput">Security Question</label>
                        <div class="combo" id="securityQuestionCombo">
                            <input type="text" id="securityQuestionInput" placeholder="Pick one or write your own" ${NOT_A_LOGIN_FIELD}>
                            <button type="button" class="combo-toggle" onclick="toggleSecurityQuestionMenu(event)" aria-label="Suggested questions">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </button>
                            <div class="combo-menu" id="securityQuestionMenu"></div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="securityAnswerInput">Answer</label>
                        <input type="text" id="securityAnswerInput" placeholder="Enter the answer" ${NOT_A_LOGIN_FIELD} spellcheck="false">
                    </div>
                    <div id="securityQuestionError" class="user-profile-error" style="display: none; margin-top: 1rem;"></div>
                    <div id="securityQuestionSuccess" class="user-profile-success" style="display: none; margin-top: 1rem;"></div>
                    <div class="user-profile-actions">
                        <button class="user-profile-save-btn" onclick="handleChangeSecurityQuestion()" id="changeSecurityQuestionBtn">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalElement);
    
    // Close on backdrop click, and close the suggestions on any click outside them.
    modalElement.addEventListener('click', function(event) {
        if (event.target === modalElement) {
            closeTopModalInfoPanel();
            return;
        }
        const combo = document.getElementById('securityQuestionCombo');
        if (combo && !combo.contains(event.target)) {
            combo.classList.remove('open');
        }
    });
    
    modalElement.style.display = 'block';
    modalElement.offsetHeight;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modalElement.classList.add('show');
        });
    });
    
    userInfoModalStack.push({ type: 'securityQuestion', element: modalElement, bodyId: `${modalId}_body` });
    
    setTimeout(() => {
        const passwordInput = document.getElementById('securityPasswordInput');
        if (passwordInput) {
            passwordInput.focus();
        }
    }, 100);
    
    ['securityPasswordInput', 'securityQuestionInput', 'securityAnswerInput'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleChangeSecurityQuestion();
                }
            });
        }
    });
    
    // Show the current question, if there is one. The answer is never sent back, so it starts empty.
    try {
        const data = await apiGetSecurityQuestion();
        const questionInput = document.getElementById('securityQuestionInput');
        if (questionInput && data && data.question) {
            questionInput.value = data.question;
        }
    } catch (error) {
        console.error('Error loading security question:', error);
    }
}

function toggleSecurityQuestionMenu(event) {
    event.stopPropagation();
    const combo = document.getElementById('securityQuestionCombo');
    if (combo.classList.contains('open')) {
        combo.classList.remove('open');
        return;
    }
    const menu = document.getElementById('securityQuestionMenu');
    menu.innerHTML = '';
    (typeof SECURITY_QUESTIONS !== 'undefined' ? SECURITY_QUESTIONS : []).forEach(question => {
        const item = document.createElement('div');
        item.className = 'combo-item';
        item.textContent = question;
        item.onclick = () => {
            const field = document.getElementById('securityQuestionInput');
            field.value = question;
            combo.classList.remove('open');
            field.focus();
        };
        menu.appendChild(item);
    });
    combo.classList.add('open');
}

async function handleChangeSecurityQuestion() {
    const passwordInput = document.getElementById('securityPasswordInput');
    const questionInput = document.getElementById('securityQuestionInput');
    const answerInput = document.getElementById('securityAnswerInput');
    const errorDiv = document.getElementById('securityQuestionError');
    const successDiv = document.getElementById('securityQuestionSuccess');
    const saveBtn = document.getElementById('changeSecurityQuestionBtn');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const password = passwordInput.value;
    const question = questionInput.value.trim();
    const answer = answerInput.value.trim();
    
    if (!password || !question || !answer) {
        errorDiv.textContent = 'Your password, a question and an answer are all required';
        errorDiv.style.display = 'block';
        (!password ? passwordInput : !question ? questionInput : answerInput).focus();
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        await apiSetSecurityQuestion(password, question, answer);
        successDiv.textContent = 'Security question changed';
        successDiv.style.display = 'block';
        setTimeout(() => {
            closeTopModalInfoPanel();
        }, 500);
    } catch (error) {
        console.error('Error changing security question:', error);
        errorDiv.textContent = error.status === 403 ? 'Incorrect password' : (apiErrorReason(error) || 'Failed to change security question');
        errorDiv.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
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
    
    // Helper function to update progress visually
    const updateProgressVisual = (progress) => {
        const circumference = 2 * Math.PI * 48;
        const offset = circumference - (progress / 100) * circumference;
        progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        progressCircle.style.strokeDashoffset = offset;
    };
    
    try {
        // Generate UUID for file name (without extension - server will add it)
        const fileId = crypto.randomUUID();
        let fileExtension = file.name.split('.').pop().toLowerCase() || 'jpg';
        if (fileExtension === 'jpeg') {
            fileExtension = 'jpg';
        }
        
        // Upload file using streaming upload
        const uploadedFileName = await apiUploadFile(file, fileId, file.type, (progress) => {
            updateProgressVisual(progress);
        });
        
        // Extract file ID from uploaded file name (remove extension)
        // Server returns filename like "uuid.jpg", we need just "uuid"
        const uploadedFileId = uploadedFileName.split('.').slice(0, -1).join('.');
        
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
        avatarImg.src = getPreviewUrl(currentPhoto.id, currentPhoto.fileType);
    } else if (currentPhoto) {
        const img = document.createElement('img');
        img.src = getPreviewUrl(currentPhoto.id, currentPhoto.fileType);
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
