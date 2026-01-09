// REST API

function getAccessToken() {
    if (!currentUser || !currentUser.session) {
        return null;
    }
    return currentUser.session.accessToken;
}

// Helper to handle response and throw on error
async function handleResponse(response) {
    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`API Error (${response.status}): ${errorText}`);
        error.status = response.status;
        error.responseText = errorText;
        throw error;
    }
    
    // Check if response has content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }
    
    // For responses without JSON body (like DELETE)
    return await response.text();
}

async function apiRegisterUser(name, username, password, deviceInfo) {
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
    return await handleResponse(response);
}

async function apiLoginUser(username, password, deviceInfo) {
    const credentials = btoa(`${username}:${password}`);
    
    const response = await fetch('/users/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`
        },
        body: JSON.stringify(deviceInfo)
    });
    return await handleResponse(response);
}

async function apiLogoutUser() {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch('/users/me/logout', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

async function apiGetCurrentUser() {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch('/users/me', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

async function apiUpdateCurrentUser(name, about) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
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
    return await handleResponse(response);
}

async function apiGetUser(userId) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch(`/users/${userId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

async function apiGetAllUsers(lastUserId = null, count = 20) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    // Build URL with count parameter and optional id parameter
    const params = new URLSearchParams({ count: count.toString() });
    if (lastUserId) {
        params.append('id', lastUserId);
    }
    
    const response = await fetch(`/users/all?${params}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

async function apiSearchUsers(query) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch(`/users?s=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

async function apiAddUserPhoto(photoId, fileType, fileSize) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch('/users/me/photos', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            photo: {
                id: photoId,
                fileType: fileType,
                fileSize: fileSize
            }
        })
    });
    return await handleResponse(response);
}

async function apiDeleteUserPhoto(photoId) {
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
    return await handleResponse(response);
}

async function apiGetChats(full = true) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const url = full ? '/chats/?full=1' : '/chats/';
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

async function apiCreateChat(isPersonal, participants) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch('/chats', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            isPersonal: isPersonal,
            participants: participants
        })
    });
    return await handleResponse(response);
}

async function apiGetMessages(chatId, count = 50) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch(`/chats/${chatId}/messages?count=${count}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

async function apiSendMessage(chatId, localId, text, attachments = null) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const requestBody = {
        localId: localId,
        text: text || null
    };
    
    if (attachments && attachments.length > 0) {
        requestBody.attachments = attachments;
    }
    
    const response = await fetch(`/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });
    return await handleResponse(response);
}

async function apiUploadFile(file, fileName, contentType, onProgress = null, onXhrCreated = null) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        if (onXhrCreated) {
            onXhrCreated(xhr);
        }
        
        if (onProgress) {
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });
        }
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Return the response text directly (filename)
                resolve(xhr.responseText);
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
        
        xhr.open('POST', '/uploads');
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
        xhr.setRequestHeader('File-Name', fileName);
        xhr.setRequestHeader('Content-Type', contentType);
        
        xhr.send(file);
    });
}

async function apiDeleteUpload(fileName) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        throw new Error('No access token available');
    }
    
    const response = await fetch(`/uploads/${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    return await handleResponse(response);
}

function getUploadUrl(fileId, fileType) {
    return `/uploads/${fileId}.${fileType}`;
}
