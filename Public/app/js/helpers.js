// Utility functions

// Fun "no messages" variants
const NO_MESSAGES_VARIANTS = [
    "No messages yet... Break the ice! 🧊",
    "Ready to start chatting? 💬",
    "This chat is a blank canvas 🎨",
    "Nothing here but potential ✨",
    "Looks like a fresh start! 🌱",
    "Your words could be the first! ✍️",
    "Time to start a conversation! 💬",
    "Empty inbox = infinite possibilities 🚀",
    "Say hello and get things rolling! 👋",
    "A new adventure begins here 🎯"
];

function getRandomNoMessagesText() {
    return NO_MESSAGES_VARIANTS[Math.floor(Math.random() * NO_MESSAGES_VARIANTS.length)];
}

// Avatar color generation - 20 distinct vivid colors
const AVATAR_COLORS = (function() {
    const colors = [];
    for (let i = 0; i < 20; i++) {
        const hue = (i * 18) % 360; // 360/20 = 18 degrees apart
        colors.push({
            text: `hsl(${hue}, 70%, 45%)`,           // Vivid text color
            background: `hsl(${hue}, 60%, 92%)`      // Light background (almost white)
        });
    }
    return colors;
})();

// Get or assign avatar color for a user
function getAvatarColorForUser(userId) {
    if (!userId) return AVATAR_COLORS[0];
    
    const storageKey = 'avatarColorAssignments';
    
    // Load existing assignments
    let assignments = {};
    try {
        assignments = JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch (e) {
        assignments = {};
    }
    
    // If user already has a color, return it
    if (assignments[userId] !== undefined) {
        return AVATAR_COLORS[assignments[userId]];
    }
    
    // Extract used indices from assignments
    const usedIndices = Object.values(assignments);
    
    // Find next available color index
    let availableIndices = [];
    for (let i = 0; i < 20; i++) {
        if (!usedIndices.includes(i)) {
            availableIndices.push(i);
        }
    }
    
    // If all colors used, reset the cycle
    if (availableIndices.length === 0) {
        availableIndices = Array.from({ length: 20 }, (_, i) => i);
    }
    
    // Pick a random color from available ones
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    
    // Save assignment
    assignments[userId] = randomIndex;
    localStorage.setItem(storageKey, JSON.stringify(assignments));
    
    return AVATAR_COLORS[randomIndex];
}

// Generate avatar initials HTML with color styling
function getAvatarInitialsHtml(name, userId, extraClasses = '') {
    const initials = getInitials(name);
    const color = getAvatarColorForUser(userId);
    const classes = extraClasses ? `avatar-initials ${extraClasses}` : 'avatar-initials';
    return `<span class="${classes}" style="color: ${color.text}; background-color: ${color.background};">${initials}</span>`;
}

// Get image HTML
function getAvatarImageHtml(imageInfo) {
    return `<img src="${getUploadUrl(imageInfo.id, imageInfo.fileType)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
}

// Apply avatar color to an existing element
function applyAvatarColor(element, name, userId) {
    const color = getAvatarColorForUser(userId);
    element.textContent = getInitials(name);
    element.style.color = color.text;
    element.style.backgroundColor = color.background;
}

// Generate local ID for messages
function generateMessageLocalId() {
    return `${currentUser.info.id}+${crypto.randomUUID()}`;
}

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

function mainImageForChat(chat) {
    if (!chat || !chat.images || !Array.isArray(chat.images) || chat.images.length === 0) return null;
    const firstImage = chat.images[0];
    if (!firstImage || !firstImage.id || !firstImage.fileType) return null;
    return firstImage;
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

// Format message time for chat list
function formatMessageTime(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today - messageDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Today - show time
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    else if (diffDays === 1) {
        return 'Yesterday';
    }
    else if (diffDays < 7) {
        // This week - show day name
        return date.toLocaleDateString([], { weekday: 'short' });
    }
    else {
        // Older - show date
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Format date for grouping messages by date
function formatChatGroupingDate(date) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today - messageDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'long' });
    } else {
        return date.toLocaleDateString([], { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

// Normalize timestamp to Date object (handles both string and number formats)
function normalizeTimestamp(timestamp) {
    if (!timestamp) return new Date();
    
    if (typeof timestamp === 'string') {
        return new Date(timestamp);
    } else if (typeof timestamp === 'number') {
        // Server sends UNIX timestamps in seconds (since 1970)
        // If timestamp is less than year 2000 in milliseconds, assume it's in seconds
        if (timestamp < 946_684_800_000) { // 2000-01-01 00:00:00
            return new Date(timestamp * 1000);
        } else {
            return new Date(timestamp);
        }
    }
    
    return new Date(timestamp);
}

// Format full date and time for tooltips
function formatFullDateTime(date) {
    const dateObj = normalizeTimestamp(date);
    return dateObj.toLocaleString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Convert links in text to clickable links
function convertLinksToClickable(text) {
    if (!text) return '';
    
    // First escape HTML to prevent XSS
    const escapedText = escapeHtml(text);
    
    // URL regex pattern that matches http, https, and www links
    const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    
    return escapedText.replace(urlRegex, function(url) {
        let href = url;
        let displayUrl = url;
        
        // Add https:// prefix for www links
        if (url.toLowerCase().startsWith('www.')) {
            href = 'https://' + url;
        }
        
        // Truncate display URL if it's too long
        if (displayUrl.length > 50) {
            displayUrl = displayUrl.substring(0, 47) + '...';
        }
        
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">${displayUrl}</a>`;
    });
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

// Get image dimensions
function getImageDimensions(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ width: 300, height: 200 });
        };
        img.src = url;
    });
}

// Get group chat display name - title or comma-joined member names (up to first 10)
function getGroupChatDisplayName(chat) {
    if (chat.isPersonal) {
        return null;
    }
    
    if (chat.title) {
        return chat.title;
    }
    
    if (!chat.allUsers || chat.allUsers.length === 0) {
        return 'Group Chat';
    }
    
    // Filter out current user and get first 10 members
    const otherMembers = chat.allUsers
        .filter(user => user.id !== currentUser?.info?.id)
        .slice(0, 10)
        .map(user => user.name || user.username || 'Unknown');
    
    if (otherMembers.length === 0) {
        return 'Group Chat';
    }
    
    return otherMembers.join(', ') + ", you";
}