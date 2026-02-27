// Add long press handler to an element
// Options:
//   - element: DOM element to attach handlers to
//   - onLongPress: callback function(event, startPosition) called when long press completes
//   - duration: duration in milliseconds (default: 500)
//   - excludeSelectors: array of selectors to exclude from triggering (e.g., ['.message-bubble', '.avatar-small'])
//   - maxMovement: maximum movement in pixels before canceling (default: 10)
function addLongPressHandler(element, options) {
    const {
        onLongPress,
        duration = 500,
        excludeSelectors = [],
        maxMovement = 10
    } = options;
    
    if (!element || !onLongPress) {
        console.error('addLongPressHandler: element and onLongPress are required');
        return null;
    }
    
    let longPressTimer = null;
    let longPressStartPos = null;
    let longPressStartEvent = null;
    let longPressCompleted = false;
    
    const startLongPress = (e) => {
        // Check if press is on excluded elements
        for (const selector of excludeSelectors) {
            if (e.target.closest(selector)) {
                return; // Don't trigger on excluded elements
            }
        }
        
        longPressCompleted = false;
        
        // Store initial position and event
        longPressStartPos = {
            x: e.touches ? e.touches[0].clientX : e.clientX,
            y: e.touches ? e.touches[0].clientY : e.clientY
        };
        longPressStartEvent = e;
        
        longPressTimer = setTimeout(() => {
            e.preventDefault();
            e.stopPropagation();
            
            // Create synthetic event with stored position
            const syntheticEvent = {
                clientX: longPressStartPos.x,
                clientY: longPressStartPos.y,
                target: longPressStartEvent.target,
                stopPropagation: () => {},
                preventDefault: () => {}
            };
            
            onLongPress(syntheticEvent, longPressStartPos);
            longPressCompleted = true;
            longPressTimer = null;
            longPressStartPos = null;
            longPressStartEvent = null;
            
            // Reset flag after a short delay
            setTimeout(() => {
                longPressCompleted = false;
            }, 100);
        }, duration);
    };
    
    const cancelLongPress = (e) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        
        // Cancel if user moved too much
        if (longPressStartPos) {
            const currentPos = {
                x: e.touches ? e.touches[0].clientX : e.clientX,
                y: e.touches ? e.touches[0].clientY : e.clientY
            };
            const distance = Math.sqrt(
                Math.pow(currentPos.x - longPressStartPos.x, 2) + 
                Math.pow(currentPos.y - longPressStartPos.y, 2)
            );
            
            if (distance > maxMovement) {
                longPressStartPos = null;
                longPressStartEvent = null;
                longPressCompleted = false;
            }
        }
    };
    
    const endLongPress = (e) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        
        // If long press completed, prevent click event from closing menu
        if (longPressCompleted && e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        longPressStartPos = null;
        longPressStartEvent = null;
    };
    
    // Prevent click event from closing menu immediately after long press
    const clickHandler = (e) => {
        if (longPressCompleted) {
            e.preventDefault();
            e.stopPropagation();
        }
    };
    
    // Touch events for mobile
    element.addEventListener('touchstart', startLongPress);
    element.addEventListener('touchmove', cancelLongPress);
    element.addEventListener('touchend', endLongPress);
    element.addEventListener('touchcancel', endLongPress);
    
    // Mouse events for desktop
    element.addEventListener('mousedown', startLongPress);
    element.addEventListener('mousemove', cancelLongPress);
    element.addEventListener('mouseup', endLongPress);
    element.addEventListener('mouseleave', endLongPress);
    
    // Click handler to prevent immediate close
    element.addEventListener('click', clickHandler, true);
    
    // Return cleanup function
    return () => {
        element.removeEventListener('touchstart', startLongPress);
        element.removeEventListener('touchmove', cancelLongPress);
        element.removeEventListener('touchend', endLongPress);
        element.removeEventListener('touchcancel', endLongPress);
        element.removeEventListener('mousedown', startLongPress);
        element.removeEventListener('mousemove', cancelLongPress);
        element.removeEventListener('mouseup', endLongPress);
        element.removeEventListener('mouseleave', endLongPress);
        element.removeEventListener('click', clickHandler, true);
        if (longPressTimer) {
            clearTimeout(longPressTimer);
        }
    };
}

// Show context menu utility
// options: { items, x, y, onAction, highlightElement, highlightClass, anchor }
// anchor: 'top-left' (default) - menu top-left at (x,y), 'bottom-left' - menu bottom-left at (x,y)
function showContextMenu(options) {
    const { items, x, y, onAction, highlightElement, highlightClass = 'menu-active', anchor = 'top-left' } = options;
    
    // Remove any existing menu and its highlight
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    const existingHighlight = document.querySelector('.' + highlightClass);
    if (existingHighlight) {
        existingHighlight.classList.remove(highlightClass);
    }
    
    // Create menu
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    menu.innerHTML = items.map(item => {
        const separator = item.separator ? '<div class="context-menu-separator"></div>' : '';
        return `${separator}<div class="context-menu-item" data-action="${item.id}">
            ${item.icon || ''}
            <span>${item.label}</span>
        </div>`;
    }).join('');
    
    // Add to DOM first to get accurate dimensions
    document.body.appendChild(menu);
    
    // Position menu
    const menuRect = menu.getBoundingClientRect();
    
    // Calculate initial position based on anchor
    let left = x;
    let top = y;
    
    if (anchor === 'bottom-left') {
        // Menu bottom-left corner at (x, y), so top = y - menuHeight
        top = y - menuRect.height;
    }
    
    // Adjust position to keep menu in viewport
    if (left + menuRect.width > window.innerWidth) {
        left = window.innerWidth - menuRect.width - 10;
    }
    if (top + menuRect.height > window.innerHeight) {
        top = window.innerHeight - menuRect.height - 10;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.zIndex = '10000'; // Ensure menu is above all modals
    
    // Add highlight to element if provided
    if (highlightElement) {
        highlightElement.classList.add(highlightClass);
    }
    
    // Handle menu item clicks
    menu.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            if (onAction) {
                onAction(action);
            }
            closeMenu();
        });
    });
    
    // Close menu function
    const closeMenu = () => {
        if (!document.body.contains(menu)) return;
        menu.remove();
        document.removeEventListener('mousedown', handleMouseDown);
        if (highlightElement) {
            highlightElement.classList.remove(highlightClass);
        }
    };
    
    // Close menu on mousedown outside menu (not click, to avoid long press release issue)
    const handleMouseDown = (e) => {
        if (!menu.contains(e.target)) {
            closeMenu();
        }
    };
    
    // Use mousedown instead of click to avoid long press release triggering close
    // Small delay to avoid catching the current mousedown if any
    setTimeout(() => {
        document.addEventListener('mousedown', handleMouseDown);
    }, 0);
    
    return { menu, close: closeMenu };
}

/**
 * Show a popup toolbar with icon-only buttons, positioned relative to a hover element.
 * @param {Object} options
 * @param {Array<{id: string, icon: string, tooltip: string}>} options.items Toolbar button definitions.
 * @param {Function} options.onAction Callback invoked with the clicked item's `id`.
 * @param {HTMLElement} options.hoverElement Element the toolbar is positioned relative to; also used for hover-based auto-hide.
 * @param {'top'|'bottom'|'left'|'right'} [options.position='top'] Where the toolbar appears relative to `hoverElement`.
 * @param {number} [options.gap=4] Spacing in pixels between `hoverElement` and the toolbar.
 * @param {HTMLElement} [options.highlightElement] Element to add `highlightClass` to while the toolbar is open.
 * @param {string} [options.highlightClass='menu-active'] CSS class applied to `highlightElement`.
 * @returns {{toolbar: HTMLElement, close: Function}}
 */
function showPopupToolbar(options) {
    const { items, onAction, highlightElement, highlightClass = 'menu-active', hoverElement, position = 'top', gap = 4 } = options;

    // If a toolbar is already open for the same hoverElement, keep it
    const existingToolbar = document.querySelector('.popup-toolbar');
    if (existingToolbar) {
        if (hoverElement && existingToolbar._hoverElement === hoverElement) {
            return { toolbar: existingToolbar, close: existingToolbar._closeToolbar };
        }
        existingToolbar._closeToolbar?.();
    }
    const existingHighlight = document.querySelector('.' + highlightClass);
    if (existingHighlight) {
        existingHighlight.classList.remove(highlightClass);
    }

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'popup-toolbar';

    toolbar.innerHTML = items.map(item =>
        `<button class="inline-button popup-toolbar-button" data-action="${item.id}" title="${item.tooltip || ''}">${item.icon || ''}</button>`
    ).join('');

    // Add to DOM first to get accurate dimensions
    document.body.appendChild(toolbar);

    // Position toolbar relative to hoverElement
    const toolbarRect = toolbar.getBoundingClientRect();
    const elRect = hoverElement ? hoverElement.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };

    let left, top;
    switch (position) {
        case 'bottom':
            left = elRect.left + (elRect.width - toolbarRect.width) / 2;
            top = elRect.bottom + gap;
            break;
        case 'left':
            left = elRect.left - toolbarRect.width - gap;
            top = elRect.top + (elRect.height - toolbarRect.height) / 2;
            break;
        case 'right':
            left = elRect.right + gap;
            top = elRect.top + (elRect.height - toolbarRect.height) / 2;
            break;
        case 'top':
        default:
            left = elRect.left + (elRect.width - toolbarRect.width) / 2;
            top = elRect.top - toolbarRect.height - gap;
            break;
    }

    // Adjust position to keep toolbar in viewport
    if (left + toolbarRect.width > window.innerWidth) {
        left = window.innerWidth - toolbarRect.width - 10;
    }
    if (top + toolbarRect.height > window.innerHeight) {
        top = window.innerHeight - toolbarRect.height - 10;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    toolbar.style.left = `${left}px`;
    toolbar.style.top = `${top}px`;
    toolbar.style.zIndex = '10000';

    // Add highlight to element if provided
    if (highlightElement) {
        highlightElement.classList.add(highlightClass);
    }

    // Store hoverElement reference for deduplication
    toolbar._hoverElement = hoverElement;

    // Handle button clicks
    toolbar.querySelectorAll('.popup-toolbar-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = button.dataset.action;
            if (onAction) {
                onAction(action);
            }
            closeToolbar();
        });
    });

    // Track last known mouse position
    let lastMouseX = left;
    let lastMouseY = top;
    const trackMouse = (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    };
    document.addEventListener('mousemove', trackMouse);

    let hideTimer = null;

    // Check if pointer is over the toolbar or the hover element
    const isPointerOver = () => {
        const tRect = toolbar.getBoundingClientRect();
        const overToolbar = lastMouseX >= tRect.left && lastMouseX <= tRect.right &&
                            lastMouseY >= tRect.top && lastMouseY <= tRect.bottom;
        if (overToolbar) return true;
        if (hoverElement) {
            const hRect = hoverElement.getBoundingClientRect();
            return lastMouseX >= hRect.left && lastMouseX <= hRect.right &&
                   lastMouseY >= hRect.top && lastMouseY <= hRect.bottom;
        }
        return false;
    };

    const scheduleHide = () => {
        if (hideTimer) return;
        hideTimer = setTimeout(() => {
            hideTimer = null;
            if (!isPointerOver()) {
                closeToolbar();
            }
        }, 500);
    };

    const cancelHide = () => {
        if (hideTimer) {
            clearTimeout(hideTimer);
            hideTimer = null;
        }
    };

    // Close toolbar function
    const closeToolbar = () => {
        if (!document.body.contains(toolbar)) return;
        cancelHide();
        toolbar.remove();
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', trackMouse);
        toolbar.removeEventListener('mouseenter', cancelHide);
        toolbar.removeEventListener('mouseleave', scheduleHide);
        if (hoverElement) {
            hoverElement.removeEventListener('mouseenter', cancelHide);
            hoverElement.removeEventListener('mouseleave', scheduleHide);
        }
        if (highlightElement) {
            highlightElement.classList.remove(highlightClass);
        }
    };

    // Store close function on the DOM element for cleanup
    toolbar._closeToolbar = closeToolbar;

    // Hover-based hide: schedule hide when mouse leaves toolbar or hoverElement
    toolbar.addEventListener('mouseenter', cancelHide);
    toolbar.addEventListener('mouseleave', scheduleHide);
    if (hoverElement) {
        hoverElement.addEventListener('mouseenter', cancelHide);
        hoverElement.addEventListener('mouseleave', scheduleHide);
    }

    // Close toolbar on mousedown outside
    const handleMouseDown = (e) => {
        if (!toolbar.contains(e.target) && !(hoverElement && hoverElement.contains(e.target))) {
            closeToolbar();
        }
    };

    setTimeout(() => {
        document.addEventListener('mousedown', handleMouseDown);
    }, 0);

    return { toolbar, close: closeToolbar };
}