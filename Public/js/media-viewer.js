// Media Viewer - Shared viewer functionality for avatars/photos

let mediaViewerPhotoIndex = 0;
let mediaViewerPhotos = [];
let mediaViewerCurrentIndex = 0;
let mediaViewerUpdateCallback = null;
let mediaViewerText = null;

function createMediaViewerHTML(photos, currentIndex, viewerId = 'mediaViewer', text = null) {
    const hasMultiplePhotos = photos.length > 1;
    
    return `
        <div class="media-viewer-content">
            <div class="media-viewer-header">
                <div class="media-viewer-title" id="${viewerId}Title"></div>
                <button class="media-viewer-close" onclick="closeMediaViewer()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 6 6 18"></path>
                        <path d="M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <div class="media-viewer-image-container">
                ${hasMultiplePhotos ? `
                <button class="media-viewer-chevron media-viewer-chevron-left" onclick="navigateMediaViewerPhoto(-1)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m15 18-6-6 6-6"></path>
                    </svg>
                </button>
                ` : ''}
                <img class="media-viewer-image" id="${viewerId}Image" src="" alt="">
                ${hasMultiplePhotos ? `
                <button class="media-viewer-chevron media-viewer-chevron-right" onclick="navigateMediaViewerPhoto(1)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m9 18 6-6-6-6"></path>
                    </svg>
                </button>
                ` : ''}
            </div>
            ${hasMultiplePhotos ? `
            <div class="media-viewer-pagination">
                ${photos.map((photo, index) => `
                    <button class="media-viewer-pagination-dot ${index === currentIndex ? 'active' : ''}" 
                            onclick="switchMediaViewerPhoto(${index})"></button>
                `).join('')}
            </div>
            ` : ''}
            ${text ? `
            <div class="media-viewer-text" id="${viewerId}Text"></div>
            ` : ''}
        </div>
    `;
}

function openMediaViewer(photos, currentIndex, updateCallback = null, text = null) {
    if (!photos || photos.length === 0) return;
    
    mediaViewerPhotos = photos;
    mediaViewerCurrentIndex = currentIndex;
    mediaViewerPhotoIndex = currentIndex;
    mediaViewerUpdateCallback = updateCallback;
    mediaViewerText = text;
    
    const viewer = document.createElement('div');
    viewer.className = 'media-viewer';
    viewer.id = 'mediaViewer';
    viewer.innerHTML = createMediaViewerHTML(photos, currentIndex, 'mediaViewer', text);
    
    document.body.appendChild(viewer);
    updateMediaViewer();
    
    // Close on background click (but not on content elements)
    viewer.addEventListener('click', (e) => {
        // Don't close if clicking on interactive elements
        if (e.target.closest('button') || e.target.closest('img') || e.target.closest('.media-viewer-header') || e.target.closest('.media-viewer-text')) {
            return;
        }
        
        // Close if clicking on viewer background or empty space in image container
        const imageContainer = viewer.querySelector('.media-viewer-image-container');
        if (e.target === viewer || (imageContainer && e.target === imageContainer)) {
            closeMediaViewer();
        }
    });
    
    // Setup keyboard navigation (use capture phase to handle before other handlers)
    document.addEventListener('keydown', handleMediaViewerKeyboard, true);
}

function updateMediaViewer() {
    const viewerImg = document.getElementById('mediaViewerImage');
    const viewerTitle = document.getElementById('mediaViewerTitle');
    const viewerText = document.getElementById('mediaViewerText');
    const currentPhoto = mediaViewerPhotos[mediaViewerPhotoIndex];
    
    if (!viewerImg || !currentPhoto) return;
    
    viewerImg.src = `/files/${currentPhoto.id}.${currentPhoto.fileType}`;
    
    // Format date and time
    if (currentPhoto.createdAt && viewerTitle) {
        const date = new Date(currentPhoto.createdAt);
        const formattedDate = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        viewerTitle.textContent = formattedDate;
    }
    
    // Update text if present
    if (viewerText && mediaViewerText) {
        viewerText.textContent = mediaViewerText;
    }
    
    // Update pagination dots
    const dots = document.querySelectorAll('.media-viewer-pagination-dot');
    dots.forEach((dot, index) => {
        if (index === mediaViewerPhotoIndex) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
    
    // Call update callback if provided
    if (mediaViewerUpdateCallback) {
        mediaViewerUpdateCallback(mediaViewerPhotoIndex);
    }
}

function navigateMediaViewerPhoto(direction) {
    if (mediaViewerPhotos.length <= 1) return;
    
    mediaViewerPhotoIndex += direction;
    if (mediaViewerPhotoIndex < 0) {
        mediaViewerPhotoIndex = mediaViewerPhotos.length - 1;
    } else if (mediaViewerPhotoIndex >= mediaViewerPhotos.length) {
        mediaViewerPhotoIndex = 0;
    }
    
    mediaViewerCurrentIndex = mediaViewerPhotoIndex;
    updateMediaViewer();
}

function switchMediaViewerPhoto(index) {
    if (index < 0 || index >= mediaViewerPhotos.length) return;
    mediaViewerPhotoIndex = index;
    mediaViewerCurrentIndex = index;
    updateMediaViewer();
}

function closeMediaViewer() {
    const viewer = document.getElementById('mediaViewer');
    if (viewer) {
        viewer.remove();
    }
    document.removeEventListener('keydown', handleMediaViewerKeyboard);
    mediaViewerUpdateCallback = null;
    mediaViewerText = null;
}

function handleMediaViewerKeyboard(e) {
    if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        closeMediaViewer();
    } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        navigateMediaViewerPhoto(-1);
    } else if (e.key === 'ArrowRight') {
        e.stopPropagation();
        navigateMediaViewerPhoto(1);
    }
}

