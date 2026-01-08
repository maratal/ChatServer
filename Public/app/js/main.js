// Global variables
let currentUser = null;
let currentChatId = null;
let chats = [];
let websocket = null;
let deviceSessionId = null;

// User selection variables
let fetchedUsers = [];
let userSearchTimeout = null;
let lastUserId = null;
let isLoadingUsers = false;
let hasMoreUsers = true;

// User info avatar state
let userInfoPhotos = [];
let userInfoCurrentPhotoIndex = 0;

// Enhanced authentication check to get current user
async function checkAuth() {
    console.log('checkAuth called');
    const currentUserData = localStorage.getItem('currentUser');
    
    console.log('Current user data:', currentUserData ? 'exists' : 'missing');
    
    if (!currentUserData) {
        console.log('No current user data, redirecting to home');
        window.location.href = '/';
        return;
    }
    
    try {
        const userData = JSON.parse(currentUserData);
        currentUser = userData;
        console.log('Parsed currentUser from localStorage:', currentUser);
        
        if (!getAccessToken()) {
            console.log('No access token in current user data, redirecting to home');
            window.location.href = '/';
            return;
        }
        
        try {
            updateCurrentUserDisplay();
        } catch (error) {
            console.error('Error updating current user display:', error);
        }
        
        // Get device session ID for WebSocket
        deviceSessionId = getDeviceSessionId();
        
        // Initialize everything
        await loadChats();
        initializeMessageInput();
        
        // Initialize attachment file input
        const attachmentInput = document.getElementById('attachmentInput');
        if (attachmentInput) {
            attachmentInput.addEventListener('change', handleAttachmentFileSelect);
        }
        
        // Initialize WebSocket if device session ID is available
        if (deviceSessionId) {
            initializeWebSocket();
        } else {
            console.error('Device sessionId is empty.');
        }
    } catch (e) {
        console.error('Error parsing current user data:', e);
        // If parsing fails, redirect to login
        window.location.href = '/';
    }
}

// Logout function
async function logout() {
    try {
        // Call logout API
        await apiLogoutUser();
    } catch (error) {
        console.error('Logout API error:', error);
    }
    
    // Clear local storage
    localStorage.removeItem('currentUser');
    
    // Redirect to home page
    window.location.href = '/';
}

// Check authentication when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        checkAuth().catch(console.error);
    });
} else {
    checkAuth().catch(console.error);
}

// Load chats from API
async function loadChats() {
    try {
        chats = await apiGetChats(true);
        displayChats();
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Check if chat is Personal Notes (personal chat with only yourself)
function isPersonalNotes(chat) {
    return chat.isPersonal && chat.allUsers.length === 1 && chat.allUsers[0].id === currentUser?.info?.id;
}

// Get the date of the last message in a chat (for sorting)
function getChatLastMessageDate(chat) {
    if (!chat.lastMessage) return null;
    
    let dateObj = chat.lastMessage.updatedAt || chat.lastMessage.createdAt;
    if (!dateObj) return null;
    
    if (typeof dateObj === 'string') {
        dateObj = new Date(dateObj);
    }
    else if (typeof dateObj === 'number') {
        // Server sends UNIX timestamps in seconds (since 1970)
        dateObj = new Date(dateObj * 1000);
    }
    
    return dateObj;
}

// Display chats in the sidebar
function displayChats() {
    const chatItems = document.getElementById('chatItems');
    chatItems.innerHTML = '';
    
    if (chats.length === 0) {
        chatItems.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No chats yet</div>';
        return;
    }
    
    // Sort chats: Personal Notes first, then by lastMessage date (newest first)
    const sortedChats = [...chats].sort((a, b) => {
        // Personal Notes always on top
        if (isPersonalNotes(a)) return -1;
        if (isPersonalNotes(b)) return 1;
        
        // Sort by lastMessage date (newest first)
        const aDate = getChatLastMessageDate(a) || new Date(0);
        const bDate = getChatLastMessageDate(b) || new Date(0);
        
        return bDate - aDate;
    });
    
    sortedChats.forEach(chat => {
        const chatItem = createChatItem(chat);
        chatItems.appendChild(chatItem);
    });

    // Restore previously selected chat from localStorage
    const savedChatId = localStorage.getItem('selectedChatId');
    if (savedChatId && chats.some(c => c.id === savedChatId)) {
        selectChat(savedChatId);
    }
}

// Create a chat item element
function createChatItem(chat) {
    const item = document.createElement('button');
    item.className = 'chat-item';
    item.dataset.chatId = chat.id; // Add chat ID as data attribute
    item.onclick = () => selectChat(chat.id);
    
    // Determine chat name and avatar
    let chatName, avatarContent, avatarClass, hasOnlineStatus = false;
    
    let avatarUserId = null;
    if (chat.isPersonal) {
        // For personal chats, show the other user's name
        const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
        if (!otherUser) {
            // Chat with oneself
            chatName = 'Personal Notes';
            avatarContent = '️🗒️';
            avatarClass = 'avatar-initials avatar-personal-notes-chat-list';
        } else {
            chatName = otherUser.name;
            avatarUserId = otherUser.id;
            // Show online status only if user is actually online
            hasOnlineStatus = otherUser.lastSeen ? isUserOnline(otherUser.lastSeen) : false;
        }
    } else {
        // For group chats, show chat title
        chatName = chat.title || 'Group Chat';
        avatarUserId = `group_${chat.id}`; // Use chat id for group color
    }
    
    // Get last message preview and time
    const lastMessageText = chat.lastMessage ? 
        truncateText(chat.lastMessage.text || '[Media]', 30) : 
        'No messages yet';
    
    const messageDate = getChatLastMessageDate(chat);
    const messageDateString = messageDate ? formatMessageTime(messageDate) : null;
    
    // Check if there are unread messages (placeholder for now)
    const unreadCount = 0; // This would come from the API
    
    // Generate avatar HTML
    let avatarHtml;
    if (avatarUserId) {
        avatarHtml = getAvatarInitialsHtml(chatName, avatarUserId);
    } else {
        // Personal notes - use special class without colors
        avatarHtml = `<span class="${avatarClass}">${escapeHtml(avatarContent)}</span>`;
    }
    
    item.innerHTML = `
        <span class="avatar-small">
            ${avatarHtml}
            ${hasOnlineStatus ? '<span class="chat-status-indicator"></span>' : ''}
        </span>
        <div class="chat-info">
            <div class="chat-header-row">
                <h3 class="chat-name">${escapeHtml(chatName)}</h3>
                ${messageDateString ? `<span class="chat-time">${messageDateString}</span>` : ''}
            </div>
            <div class="chat-message-row">
                <p class="chat-last-message">${escapeHtml(lastMessageText)}</p>
                ${unreadCount > 0 ? `<div class="chat-badge">${unreadCount}</div>` : ''}
            </div>
        </div>
    `;
    
    return item;
}

// Select a chat and load its messages
async function selectChat(chatId) {
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    // Update active state - find button by data-chatId
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.chatId === chatId) {
            item.classList.add('active');
        }
    });
    
    if (currentChatId === chatId) {
        return;
    }
    currentChatId = chatId;
    
    // Save selected chat ID to localStorage
    localStorage.setItem('selectedChatId', chatId);

    // Update chat header
    const chatHeader = document.getElementById('chatHeader');
    const chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    const chatTitle = document.getElementById('chatTitle');
    const chatSubtitle = document.getElementById('chatSubtitle');
    const chatHeaderStatusIndicator = document.getElementById('chatHeaderStatusIndicator');
    const messagesContainer = document.getElementById('messagesContainer');
    
    // Add/remove personal chat class for styling
    if (chat.isPersonal) {
        messagesContainer.classList.add('personal-chat');
        const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
        if (!otherUser) {
            // Chat with oneself - Personal Notes (no avatar color)
            chatTitle.textContent = 'Personal Notes';
            chatSubtitle.textContent = '';
            chatHeaderAvatar.textContent = '️🗒️';
            chatHeaderAvatar.style.color = '';
            chatHeaderAvatar.style.backgroundColor = '';
            chatHeaderStatusIndicator.style.display = 'none'; // No status for self-chat
        } else {
            chatTitle.textContent = otherUser.name;
            // Show last seen (status indicator shows if online)
            const isOnline = otherUser.lastSeen ? isUserOnline(otherUser.lastSeen) : false;
            const lastSeen = otherUser.lastSeen ? formatLastSeen(otherUser.lastSeen) : null;
            chatSubtitle.textContent = lastSeen ? `Last seen ${lastSeen}` : '';
            applyAvatarColor(chatHeaderAvatar, otherUser.name, otherUser.id);
            chatHeaderStatusIndicator.style.display = isOnline ? 'block' : 'none';
        }
    } else {
        messagesContainer.classList.remove('personal-chat');
        const groupName = chat.title || 'Group Chat';
        chatTitle.textContent = groupName;
        chatSubtitle.textContent = `${chat.allUsers.length} members`;
        applyAvatarColor(chatHeaderAvatar, groupName, `group_${chat.id}`);
        chatHeaderStatusIndicator.style.display = 'none'; // No status for group chats
    }
    
    chatHeader.style.display = 'flex';
    
    // Add click handler to chat header avatar
    const chatHeaderAvatarContainer = document.getElementById('chatHeaderAvatarContainer');
    if (chatHeaderAvatarContainer) {
        if (chat.isPersonal) {
            const user = chat.allUsers.find(user => user.id !== currentUser?.info.id) || currentUser.info;
            chatHeaderAvatarContainer.onclick = () => showUserInfo(user.id);
        } else {
            // For group chats, do nothing (yet)
            chatHeaderAvatarContainer.onclick = null;
        }
    }
    
    // Show message input
    const messageInputContainer = document.getElementById('messageInputContainer');
    messageInputContainer.style.display = 'flex';
    
    // Load messages
    await loadMessages(chatId);
}

// Update current user display in chat list header
function updateCurrentUserDisplay() {
    console.log('updateCurrentUserDisplay called', currentUser);
    
    if (!currentUser || !currentUser.info) {
        console.log('No currentUser or currentUser.info');
        return;
    }
    
    const userName = currentUser.info.name || currentUser.info.username || 'User';
    
    console.log('Updating display with:', userName);
    
    // Update sidebar current user avatar
    const sidebarAvatar = document.getElementById('sidebarCurrentUserAvatar');
    if (sidebarAvatar) {
        const mainPhoto = mainPhotoForUser(currentUser.info);
        
        if (mainPhoto) {
            sidebarAvatar.innerHTML = `<img src="${getUploadUrl(mainPhoto.id, mainPhoto.fileType)}" alt="">`;
        } else {
            sidebarAvatar.innerHTML = getAvatarInitialsHtml(userName, currentUser.info.id);
        }
    }
}

// Update chat list when new message arrives
function updateChatListWithMessage(message) {
    const chat = chats.find(c => c.id === message.chatId);
    if (chat) {
        chat.lastMessage = message;
        
        // Find the specific chat item in the DOM and update only the last message text
        const chatItem = document.querySelector(`[data-chat-id="${message.chatId}"]`);
        if (chatItem) {
            const lastMessageElement = chatItem.querySelector('.chat-last-message');
            if (lastMessageElement) {
                const lastMessageText = message.text ? 
                    truncateText(message.text, 30) : 
                    '[Media]';
                lastMessageElement.textContent = lastMessageText;
            }
        }
    }
}


// Get device session ID from current user session
function getDeviceSessionId() {
    return currentUser.session.id;
}

// User Selection Functions
function openUserSelection() {
    const modal = document.getElementById('userSelectionModal');
    modal.style.display = 'block';
    
    // Force a reflow to ensure initial styles are applied
    modal.offsetHeight;
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });
    
    // Reset state
    fetchedUsers = [];
    lastUserId = null;
    hasMoreUsers = true;
    isLoadingUsers = false;
    
    // Clear search input
    document.getElementById('userSearchInput').value = '';
    
    // Load initial users
    loadUsers();
    
    // Setup search listener
    setupUserSearch();
    
    // Setup scroll listener for pagination
    setupUserScrollPagination();
}

function closeUserSelection() {
    const modal = document.getElementById('userSelectionModal');
    modal.classList.remove('show');
    
    // Hide modal after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
    
    // Clear timeout if exists
    if (userSearchTimeout) {
        clearTimeout(userSearchTimeout);
        userSearchTimeout = null;
    }
}

function setupUserSearch() {
    const searchInput = document.getElementById('userSearchInput');
    
    searchInput.addEventListener('input', function() {
        // Clear existing timeout
        if (userSearchTimeout) {
            clearTimeout(userSearchTimeout);
        }
        
        // Set new timeout for search
        userSearchTimeout = setTimeout(() => {
            const query = this.value.trim();
            if (query) {
                searchUsers(query);
            } else {
                // Reset to all users if search is cleared
                fetchedUsers = [];
                lastUserId = null;
                hasMoreUsers = true;
                loadUsers();
            }
        }, 300);
    });
}

function setupUserScrollPagination() {
    const usersList = document.getElementById('usersList');
    
    usersList.addEventListener('scroll', function() {
        // Check if scrolled to bottom
        if (this.scrollTop + this.clientHeight >= this.scrollHeight - 5) {
            // Load more users if available and not currently loading
            if (hasMoreUsers && !isLoadingUsers && !document.getElementById('userSearchInput').value.trim()) {
                loadUsers();
            }
        }
    });
}

async function loadUsers() {
    if (isLoadingUsers || !hasMoreUsers) return;
    
    isLoadingUsers = true;
    
    try {
        const users = await apiGetAllUsers(lastUserId || null);
        
        // Add users to current users
        if (users.length > 0) {
            fetchedUsers = [...fetchedUsers, ...users];
            // Update lastUserId to the ID of the last user for cursor-based pagination
            lastUserId = users[users.length - 1].id;
        }
        
        // Set hasMoreUsers to false if we got less than the requested amount (20)
        if (users.length < 20) {
            hasMoreUsers = false;
        }
        
        displayUsers();
    } catch (error) {
        console.error('Error loading users:', error);
        showUsersError('Error loading users');
    } finally {
        isLoadingUsers = false;
    }
}

async function searchUsers(query) {
    const usersList = document.getElementById('usersList');
    
    // Show loading
    usersList.innerHTML = '<div class="users-loading">Searching users...</div>';
    
    try {
        const users = await apiSearchUsers(query);
        fetchedUsers = users;
        displayUsers();
    } catch (error) {
        console.error('Error searching users:', error);
        showUsersError('Error searching users');
    }
}

function displayUsers() {
    const usersList = document.getElementById('usersList');
    
    if (fetchedUsers.length === 0) {
        usersList.innerHTML = '<div class="users-empty">No users found</div>';
        return;
    }
    
    let html = '';
    fetchedUsers.forEach(user => {
        const userName = user.name || user.username || '?';
        const avatarHtml = getAvatarInitialsHtml(userName, user.id);
        html += `
            <div class="user-item" onclick="selectUser(${user.id})">
                <div class="avatar-small">${avatarHtml}</div>
                <div class="user-item-info">
                    <div class="user-item-name">${escapeHtml(user.name || user.username || 'Unknown User')}</div>
                    <div class="user-item-username">@${escapeHtml(user.username || 'unknown')}</div>
                </div>
            </div>
        `;
    });
    
    // Add loading indicator if there are more users to load
    if (hasMoreUsers && !document.getElementById('userSearchInput').value.trim()) {
        html += '<div class="users-loading" style="padding: 20px;">Loading more users...</div>';
    }
    
    usersList.innerHTML = html;
}

function showUsersError(message) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = `<div class="users-empty">${message}</div>`;
}

async function selectUser(userId) {
    // Close modal
    closeUserSelection();
    
    // Create or find chat with this user
    await createOrOpenPersonalChat(userId);
}

// Find personal chat by user ID or Personal Notes if userId is the current user
function findPersonalChatByUserId(userId) {
    return chats.find(chat => {
        if (!chat.isPersonal) return false;
        
        if (currentUser?.info?.id === userId) {
            // Personal Notes: chat with only yourself
            return chat.allUsers.length === 1 && chat.allUsers[0].id === userId;
        } else {
            // Personal chat with another user: must have exactly 2 users including the target
            return chat.allUsers.length === 2 && chat.allUsers.some(user => user.id === userId);
        }
    });
}

async function createOrOpenPersonalChat(userId) {
    try {
        const existingChat = findPersonalChatByUserId(userId);
        
        if (existingChat) {
            // Open existing chat
            selectChat(existingChat.id);
            return;
        }
        
        // Create new personal chat
        const newChat = await apiCreateChat(true, [userId]);
        
        // Add to chats list
        chats.unshift(newChat);
        
        // Refresh chat display
        displayChats();
        
        // Select the new chat
        selectChat(newChat.id);
    } catch (error) {
        console.error('Error creating chat:', error);
        alert('Error creating chat. Please try again.');
    }
}

// Close modal when clicking outside
document.addEventListener('click', function(event) {
    const modal = document.getElementById('userSelectionModal');
    if (event.target === modal) {
        closeUserSelection();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeUserSelection();
    }
});

// Add plus button click handler when page loads
document.addEventListener('DOMContentLoaded', function() {
    const addChatButton = document.getElementById('addChatButton');
    if (addChatButton) {
        addChatButton.addEventListener('click', openUserSelection);
    }
});

// User Info Modal Functions
async function showUserInfo(userId) {
    if (!userId) return;
    
    const modal = document.getElementById('userInfoModal');
    const body = document.getElementById('userInfoBody');
    
    // Show modal - same pattern as user selection modal
    modal.style.display = 'block';
    // Force a reflow to ensure initial styles are applied
    modal.offsetHeight;
    
    // Trigger animation after display is set
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    });
    
    body.innerHTML = '<div class="user-info-loading">Loading user information...</div>';

    try {
        const user = await apiGetUser(userId);
        console.log('User data received:', user);
        displayUserInfo(user);
    } catch (error) {
        console.error('Error fetching user info:', error);
        body.innerHTML = `<div class="user-info-loading" style="color: #ef4444;">Error: ${error.message || 'Failed to load user information'}</div>`;
    }
}

function displayUserInfo(user) {
    const body = document.getElementById('userInfoBody');
    
    const name = user.name || user.username || 'Unknown User';
    const username = user.username || 'unknown';
    const about = user.about || '';
    const lastSeen = user.lastSeen ? formatLastSeen(user.lastSeen) : null;
    const isOnline = user.lastSeen ? isUserOnline(user.lastSeen) : false;
    const avatarColor = getAvatarColorForUser(user.id);
    
    // Store photos globally
    userInfoPhotos = user.photos || [];
    userInfoCurrentPhotoIndex = 0;
    
    // Get current photo
    const currentPhoto = userInfoPhotos.length > 0 ? userInfoPhotos[userInfoCurrentPhotoIndex] : null;
    const photoUrl = currentPhoto ? getUploadUrl(currentPhoto.id, currentPhoto.fileType) : null;
    const hasMultiplePhotos = userInfoPhotos.length > 1;
    
    let html = `
        <div class="user-info-avatar-container">
            <div class="user-info-avatar-wrapper" id="userInfoAvatarWrapper">
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-left" onclick="event.stopPropagation(); navigateUserInfoPhoto(-1)" title="Previous photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m15 18-6-6 6-6"></path>
                    </svg>
                </button>
                ` : ''}
                <div class="user-info-avatar" id="userInfoAvatar" style="cursor: ${photoUrl ? 'pointer' : 'default'};">
                    ${photoUrl ? `<img src="${photoUrl}" alt="" id="userInfoAvatarImg">` : `<span class="avatar-initials" style="color: ${avatarColor.text}; background-color: ${avatarColor.background};">${getInitials(name)}</span>`}
                </div>
                ${hasMultiplePhotos ? `
                <button class="user-profile-avatar-chevron user-profile-avatar-chevron-right" onclick="event.stopPropagation(); navigateUserInfoPhoto(1)" title="Next photo">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </button>
                ` : ''}
            </div>
            ${hasMultiplePhotos ? `
            <div class="user-profile-avatar-pagination">
                ${userInfoPhotos.map((photo, index) => `
                    <button class="user-profile-avatar-pagination-dot ${index === userInfoCurrentPhotoIndex ? 'active' : ''}" 
                            onclick="event.stopPropagation(); switchUserInfoPhoto(${index})" 
                            title="Photo ${index + 1}"></button>
                `).join('')}
            </div>
            ` : ''}
        </div>
        <div class="user-info-name">${escapeHtml(name)}</div>
        <div class="user-info-username">@${escapeHtml(username)}</div>
    `;
    
    // Status section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Status</div>
            <div class="user-info-status">
                <span class="user-info-status-indicator ${isOnline ? '' : 'offline'}"></span>
                <span>${isOnline ? 'Online' : lastSeen ? `Last seen ${lastSeen}` : 'Offline'}</span>
            </div>
        </div>
    `;
    
    // About section
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">About</div>
            <div class="user-info-about ${about ? '' : 'empty'}">
                ${about ? escapeHtml(about) : 'No bio available'}
            </div>
        </div>
    `;
    
    // Meta information
    html += `
        <div class="user-info-section">
            <div class="user-info-section-title">Information</div>
            <div class="user-info-meta">
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span>User ID: ${user.id || 'N/A'}</span>
                </div>
                ${lastSeen ? `
                <div class="user-info-meta-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Last seen: ${lastSeen}</span>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    body.innerHTML = html;
    
    // Add click handler to avatar after HTML is inserted
    const avatar = document.getElementById('userInfoAvatar');
    if (avatar && photoUrl) {
        avatar.addEventListener('click', function(event) {
            // Don't open viewer if clicking on chevrons
            if (event.target.closest('.user-profile-avatar-chevron')) {
                return;
            }
            openUserInfoViewer();
        });
    }
}

function navigateUserInfoPhoto(direction) {
    if (userInfoPhotos.length <= 1) return;
    
    userInfoCurrentPhotoIndex += direction;
    if (userInfoCurrentPhotoIndex < 0) {
        userInfoCurrentPhotoIndex = userInfoPhotos.length - 1;
    } else if (userInfoCurrentPhotoIndex >= userInfoPhotos.length) {
        userInfoCurrentPhotoIndex = 0;
    }
    
    updateUserInfoAvatarDisplay();
}

function switchUserInfoPhoto(index) {
    if (index < 0 || index >= userInfoPhotos.length) return;
    userInfoCurrentPhotoIndex = index;
    updateUserInfoAvatarDisplay();
}

function updateUserInfoAvatarDisplay() {
    const avatar = document.getElementById('userInfoAvatar');
    const avatarImg = document.getElementById('userInfoAvatarImg');
    const currentPhoto = userInfoPhotos[userInfoCurrentPhotoIndex];
    
    if (!avatar) return;
    
    if (currentPhoto && avatarImg) {
        avatarImg.src = getUploadUrl(currentPhoto.id, currentPhoto.fileType);
    } else if (currentPhoto) {
        const img = document.createElement('img');
        img.src = getUploadUrl(currentPhoto.id, currentPhoto.fileType);
        img.alt = '';
        img.id = 'userInfoAvatarImg';
        avatar.innerHTML = '';
        avatar.appendChild(img);
    }
    
    // Update pagination dots
    const dots = document.querySelectorAll('#userInfoBody .user-profile-avatar-pagination-dot');
    dots.forEach((dot, index) => {
        if (index === userInfoCurrentPhotoIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function openUserInfoViewer() {
    if (userInfoPhotos.length === 0) return;
    
    openMediaViewer(userInfoPhotos, userInfoCurrentPhotoIndex, (newIndex) => {
        userInfoCurrentPhotoIndex = newIndex;
        updateUserInfoAvatarDisplay();
    });
}

function closeUserInfo() {
    const modal = document.getElementById('userInfoModal');
    modal.classList.remove('show');
    // Hide modal after animation completes
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function isUserOnline(lastSeen) {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    // Consider online if lastSeen was within 5 minutes
    return diffMins < 5;
}

// Handle avatar clicks using event delegation
document.addEventListener('click', function(event) {
    // Check if clicked element is a message avatar or inside it
    let avatar = event.target.closest('.message-row .avatar-small[data-clickable="true"]');
    
    // Also check if the clicked element itself is the avatar
    if (!avatar && event.target.classList.contains('avatar-small') && event.target.dataset.clickable === 'true') {
        avatar = event.target;
    }
    
    // Also check if clicked inside avatar initials
    if (!avatar && event.target.closest('.avatar-initials')) {
        avatar = event.target.closest('.avatar-small[data-clickable="true"]');
    }
    
    if (avatar && avatar.dataset.authorId) {
        event.preventDefault();
        event.stopPropagation();
        const userId = parseInt(avatar.dataset.authorId);
        if (userId && !isNaN(userId)) {
            console.log('Opening user info for user ID:', userId);
            showUserInfo(userId);
            return;
        }
    }
    
    // Close user info modal when clicking outside
    // Don't close if viewer is open
    const viewer = document.getElementById('mediaViewer');
    if (viewer && (viewer === event.target || viewer.contains(event.target))) {
        return;
    }
    const modal = document.getElementById('userInfoModal');
    const content = document.querySelector('.user-info-content');
    if (modal && modal.classList.contains('show') && content && !content.contains(event.target)) {
        closeUserInfo();
    }
}, true); // Use capture phase to catch events earlier

// Close user info modal on Escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Don't close user info panel if viewer is open
        const viewer = document.getElementById('mediaViewer');
        if (viewer) {
            return; // Viewer will handle Escape key
        }
        const modal = document.getElementById('userInfoModal');
        if (modal && modal.classList.contains('show')) {
            closeUserInfo();
        }
    }
}, true); // Use capture phase
