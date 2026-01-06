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
    const accessToken = getAccessToken();
    
    if (accessToken) {
        try {
            // Call logout API
            await fetch('/users/me/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
        } catch (error) {
            console.error('Logout API error:', error);
        }
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
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        window.location.href = '/';
        return;
    }
    
    try {
        const response = await fetch('/chats/?full=1', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            chats = await response.json();
            displayChats();
        } else {
            console.error('Failed to load chats:', response.statusText);
        }
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Display chats in the sidebar
function displayChats() {
    const chatItems = document.getElementById('chatItems');
    chatItems.innerHTML = '';
    
    if (chats.length === 0) {
        chatItems.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No chats yet</div>';
        return;
    }
    
    chats.forEach(chat => {
        const chatItem = createChatItem(chat);
        chatItems.appendChild(chatItem);
    });
}

// Create a chat item element
function createChatItem(chat) {
    const item = document.createElement('button');
    item.className = 'chat-item';
    item.dataset.chatId = chat.id; // Add chat ID as data attribute
    item.onclick = () => selectChat(chat.id);
    
    // Determine chat name and avatar
    let chatName, avatarContent, hasOnlineStatus = false;
    
    if (chat.isPersonal) {
        // For personal chats, show the other user's name
        const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
        if (!otherUser) {
            // Chat with oneself
            chatName = 'Personal Notes';
            avatarContent = '✏️';
        } else {
            chatName = otherUser.name;
            avatarContent = getInitials(otherUser.name);
            hasOnlineStatus = true; // Show online status for personal chats
        }
    } else {
        // For group chats, show chat title
        chatName = chat.title || 'Group Chat';
        avatarContent = getInitials(chatName);
    }
    
    // Get last message preview and time
    const lastMessageText = chat.lastMessage ? 
        truncateText(chat.lastMessage.text || '[Media]', 30) : 
        'No messages yet';
    
    const messageTime = chat.lastMessage ? 
        formatMessageTime(new Date(chat.lastMessage.createdAt)) : '';
    
    // Check if there are unread messages (placeholder for now)
    const unreadCount = 0; // This would come from the API
    
    item.innerHTML = `
        <div class="chat-avatar">
            <span class="chat-avatar-container">
                <span class="chat-avatar-initials">${escapeHtml(avatarContent)}</span>
                ${hasOnlineStatus ? '<span class="chat-status-indicator"></span>' : ''}
            </span>
        </div>
        <div class="chat-info">
            <div class="chat-header-row">
                <h3 class="chat-name">${escapeHtml(chatName)}</h3>
                ${messageTime ? `<span class="chat-time">${messageTime}</span>` : ''}
            </div>
            <div class="chat-message-row">
                <p class="chat-last-message">${escapeHtml(lastMessageText)}</p>
                ${unreadCount > 0 ? `<div class="chat-badge">${unreadCount}</div>` : ''}
            </div>
        </div>
    `;
    
    return item;
}

// Format message time for chat list
function formatMessageTime(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        // Today - show time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
        // Yesterday
        return 'Yesterday';
    } else if (days < 7) {
        // This week - show day name
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        // Older - show date
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Select a chat and load its messages
async function selectChat(chatId) {
    currentChatId = chatId;
    
    // Update active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
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
            // Chat with oneself
            chatTitle.textContent = 'Personal Notes';
            chatSubtitle.textContent = 'Notes to yourself';
            chatHeaderAvatar.textContent = '✏️';
            chatHeaderStatusIndicator.style.display = 'none'; // No status for self-chat
        } else {
            chatTitle.textContent = otherUser.name;
            chatSubtitle.textContent = `Online`;
            chatHeaderAvatar.textContent = getInitials(otherUser.name);
            console.log('Setting status indicator to visible for user:', otherUser.name);
            chatHeaderStatusIndicator.style.display = 'block'; // Show status for other users
        }
    } else {
        messagesContainer.classList.remove('personal-chat');
        chatTitle.textContent = chat.title || 'Group Chat';
        chatSubtitle.textContent = `${chat.allUsers.length} members`;
        chatHeaderAvatar.textContent = getInitials(chat.title || 'Group Chat');
        chatHeaderStatusIndicator.style.display = 'none'; // No status for group chats
    }
    
    chatHeader.style.display = 'flex';
    
    // Add click handler to chat header avatar
    const chatHeaderAvatarContainer = document.getElementById('chatHeaderAvatarContainer');
    if (chatHeaderAvatarContainer) {
        if (chat.isPersonal) {
            const otherUser = chat.allUsers.find(user => user.id !== currentUser?.info.id);
            if (otherUser) {
                chatHeaderAvatarContainer.onclick = () => showUserInfo(otherUser.id);
                chatHeaderAvatarContainer.style.cursor = 'pointer';
            } else {
                chatHeaderAvatarContainer.onclick = null;
                chatHeaderAvatarContainer.style.cursor = 'default';
            }
        } else if (chat.isPersonalNotesChat) {
            // For personal notes, don't make avatar clickable
            chatHeaderAvatarContainer.onclick = null;
            chatHeaderAvatarContainer.style.cursor = 'default';
        } else {
            // For group chats, do nothing (yet)
            chatHeaderAvatarContainer.onclick = null;
            chatHeaderAvatarContainer.style.cursor = 'pointer';
        }
    }
    
    // Show message input
    const messageInputContainer = document.getElementById('messageInputContainer');
    messageInputContainer.style.display = 'flex';
    
    // Load messages
    await loadMessages(chatId);
}


// Utility functions
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(word => word[0]).join('').toUpperCase().substring(0, 2);
}

function mainPhotoForUser(user) {
    if (!user || !user.photos || !Array.isArray(user.photos) || user.photos.length === 0) return null;
    const firstPhoto = user.photos[0];
    if (!firstPhoto || !firstPhoto.id || !firstPhoto.fileType) return null;
    return firstPhoto;
}

function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    const sidebarAvatar = document.getElementById('sidebarCurrentUserAvatarContent');
    if (sidebarAvatar) {
        const mainPhoto = mainPhotoForUser(currentUser.info);
        
        if (mainPhoto) {
            // Clear and add image
            sidebarAvatar.innerHTML = '';
            const img = document.createElement('img');
            img.src = `/uploads/${mainPhoto.id}.${mainPhoto.fileType}`;
            img.alt = '';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.borderRadius = '50%';
            img.style.objectFit = 'cover';
            sidebarAvatar.appendChild(img);
        } else {
            const initials = getInitials(userName);
            sidebarAvatar.textContent = initials;
        }
    }
}

// Profile menu functionality
function toggleProfileMenu() {
    const menu = document.getElementById('profileMenu');
    const isVisible = menu.style.display === 'block';
    menu.style.display = isVisible ? 'none' : 'block';
}

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('profileMenu');
    const button = document.getElementById('profileMenuButton');
    
    if (menu && button && !menu.contains(event.target) && !button.contains(event.target)) {
        menu.style.display = 'none';
    }
});

// WebSocket functionality
function initializeWebSocket() {
    if (!deviceSessionId) {
        console.warn('No device session ID available for WebSocket');
        return;
    }
    
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.warn('No access token available for WebSocket');
        return;
    }
    
    const protocol = 'ws:'; // window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/${deviceSessionId}?token=${encodeURIComponent(accessToken)}`;
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = function() {
            console.log('WebSocket connected');
        };
        
        websocket.onmessage = function(event) {
            console.log('WebSocket received:', event.data);
            
            // Handle both text and binary (Blob) messages
            if (event.data instanceof Blob) {
                // Convert Blob to text
                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        console.log('Blob content as text:', reader.result);
                        const notification = JSON.parse(reader.result);
                        handleWebSocketMessage(notification);
                    } catch (error) {
                        console.error('Error parsing Blob message as JSON:', error);
                        console.error('Blob text content:', reader.result);
                        console.error('First 100 characters:', reader.result.substring(0, 100));
                    }
                };
                reader.readAsText(event.data);
            } else {
                // Handle text messages normally
                try {
                    const notification = JSON.parse(event.data);
                    handleWebSocketMessage(notification);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    console.error('Raw message data:', event.data);
                    console.error('Message type:', typeof event.data);
                    console.error('First 100 characters:', event.data.substring(0, 100));
                }
            }
        };
        
        websocket.onclose = function(event) {
            console.log('WebSocket disconnected');
            console.log('Close code:', event.code);
            console.log('Close reason:', event.reason);
            console.log('Was clean:', event.wasClean);
            
            // Attempt to reconnect after a delay
            setTimeout(() => {
                if (deviceSessionId) {
                    initializeWebSocket();
                }
            }, 5000);
        };
        
        websocket.onerror = function(error) {
            console.error('WebSocket error:', error);
            console.error('WebSocket URL:', wsUrl);
            console.error('Ready state:', websocket.readyState);
        };
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
    }
}

// Handle WebSocket messages
function handleWebSocketMessage(notification) {
    if (notification.event === 'message' && notification.payload) {
        const message = notification.payload;
        
        // Check if this is for the current chat
        if (message.chatId === currentChatId) {
            // Check if we already have this message (by localId)
            const existingElement = document.querySelector(`[data-local-id="${message.localId}"]`);
            
            if (existingElement) {
                // Update existing message
                updateMessageInChat(message.localId, message);
            } else {
                // Add new message from others
                addMessageToChat(message, true);
            }
        }
        
        // Update chat list with new message
        updateChatListWithMessage(message);
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

// Get access token from current user session
function getAccessToken() {
    return currentUser.session.accessToken;
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
    
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        showUsersError('Authentication required');
        return;
    }
    
    isLoadingUsers = true;
    
    try {
        const response = await fetch(`/users/all?id=${lastUserId || ''}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            
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
        } else {
            console.error('Failed to load users:', response.statusText);
            showUsersError('Failed to load users');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showUsersError('Error loading users');
    } finally {
        isLoadingUsers = false;
    }
}

async function searchUsers(query) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        showUsersError('Authentication required');
        return;
    }
    
    const usersList = document.getElementById('usersList');
    
    // Show loading
    usersList.innerHTML = '<div class="users-loading">Searching users...</div>';
    
    try {
        const response = await fetch(`/users?s=${encodeURIComponent(query)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (response.ok) {
            const users = await response.json();
            
            fetchedUsers = users;
            displayUsers();
        } else {
            console.error('Failed to search users:', response.statusText);
            showUsersError('Failed to search users');
        }
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
        const userInitials = getInitials(user.name || user.username || '?');
        html += `
            <div class="user-item" onclick="selectUser(${user.id})">
                <div class="user-item-avatar">${userInitials}</div>
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

async function createOrOpenPersonalChat(userId) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        alert('Authentication required. Please refresh the page.');
        return;
    }
    
    try {
        // First, check if we already have a personal chat with this user
        const existingChat = chats.find(chat => 
            chat.isPersonal && 
            chat.allUsers.some(user => user.id === userId)
        );
        
        if (existingChat) {
            // Open existing chat
            selectChat(existingChat.id);
            return;
        }
        
        // Create new personal chat
        const response = await fetch('/chats', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                isPersonal: true,
                participants: [userId]
            })
        });
        
        if (response.ok) {
            const newChat = await response.json();
            
            // Add to chats list
            chats.unshift(newChat);
            
            // Refresh chat display
            displayChats();
            
            // Select the new chat
            selectChat(newChat.id);
        } else {
            console.error('Failed to create chat:', response.statusText);
            alert('Failed to create chat. Please try again.');
        }
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
    
    const accessToken = getAccessToken(); // optional in this request

    try {
        const response = await fetch(`/users/${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Failed to fetch user info:', response.status, errorText);
            throw new Error(`Failed to fetch user info: ${response.status} ${errorText}`);
        }
        
        const user = await response.json();
        console.log('User data received:', user);
        displayUserInfo(user);
    } catch (error) {
        console.error('Error fetching user info:', error);
        body.innerHTML = `<div class="user-info-loading" style="color: #ef4444;">Error: ${error.message || 'Failed to load user information'}</div>`;
    }
}

// User info avatar state
let userInfoPhotos = [];
let userInfoCurrentPhotoIndex = 0;

function displayUserInfo(user) {
    const body = document.getElementById('userInfoBody');
    
    const initials = getInitials(user.name || user.username || '?');
    const name = user.name || user.username || 'Unknown User';
    const username = user.username || 'unknown';
    const about = user.about || '';
    const lastSeen = user.lastSeen ? formatLastSeen(user.lastSeen) : null;
    const isOnline = user.lastSeen ? isUserOnline(user.lastSeen) : false;
    
    // Store photos globally
    userInfoPhotos = user.photos || [];
    userInfoCurrentPhotoIndex = 0;
    
    // Get current photo
    const currentPhoto = userInfoPhotos.length > 0 ? userInfoPhotos[userInfoCurrentPhotoIndex] : null;
    const photoUrl = currentPhoto ? `/uploads/${currentPhoto.id}.${currentPhoto.fileType}` : null;
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
                    ${photoUrl ? `<img src="${photoUrl}" alt="" id="userInfoAvatarImg">` : initials}
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
        avatarImg.src = `/uploads/${currentPhoto.id}.${currentPhoto.fileType}`;
    } else if (currentPhoto) {
        const img = document.createElement('img');
        img.src = `/uploads/${currentPhoto.id}.${currentPhoto.fileType}`;
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

function formatLastSeen(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) {
        return 'just now';
    } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
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
    let avatar = event.target.closest('.message-avatar-small[data-clickable="true"]');
    
    // Also check if the clicked element itself is the avatar
    if (!avatar && event.target.classList.contains('message-avatar-small') && event.target.dataset.clickable === 'true') {
        avatar = event.target;
    }
    
    // Also check if clicked inside avatar initials
    if (!avatar && event.target.closest('.message-avatar-initials')) {
        avatar = event.target.closest('.message-avatar-small[data-clickable="true"]');
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
