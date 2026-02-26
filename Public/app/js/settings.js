// Settings – Theme Color Management

const THEMES = [
    { id: 'pink',    hue: 335, saturation: 100, lightness: 50, label: 'Pink'    },
    { id: 'rose',    hue: 350, saturation: 90,  lightness: 50, label: 'Rose'    },
    { id: 'purple',  hue: 273, saturation: 90,  lightness: 50, label: 'Purple'  },
    { id: 'violet',  hue: 250, saturation: 85,  lightness: 55, label: 'Violet'  },
    { id: 'blue',    hue: 220, saturation: 90,  lightness: 50, label: 'Blue'    },
    { id: 'cyan',    hue: 198, saturation: 90,  lightness: 45, label: 'Cyan'    },
    { id: 'emerald', hue: 160, saturation: 75,  lightness: 42, label: 'Emerald' },
    { id: 'orange',  hue: 24,  saturation: 95,  lightness: 50, label: 'Orange'  },
];

const DEFAULT_THEME_ID = 'pink';
const STORAGE_THEME = 'chatserver_theme';
const STORAGE_MODE  = 'chatserver_mode';

// ── Helpers ───────────────────────────────────────────────────────

const root = document.documentElement;

function getThemeById(id) {
    return THEMES.find(t => t.id === id) || THEMES[0];
}

function themeHsl({ hue, saturation, lightness }) {
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function isDark() {
    return root.classList.contains('dark');
}

// Returns the HSS string for contrast text over a given hue/lightness
function contrastForeground(hue, lightness) {
    const isYellowish = hue >= 40 && hue <= 75;
    return (isYellowish && lightness >= 45) ? '0 0% 13%' : '0 0% 100%';
}

// ── Theme ─────────────────────────────────────────────────────────

function applyTheme(theme) {
    const { hue, saturation, lightness } = theme;
    const fg      = contrastForeground(hue, lightness);
    const primary = `${hue} ${saturation}% ${lightness}%`;
    const ring    = `${hue} 70% 49%`;
    const tintL   = isDark() ? '28%' : '93%';
    const tintFgL = isDark() ? '85%' : '20%';
    const tint    = `${hue} ${isDark() ? 28 : 16}% ${tintL}`;
    const tintFg  = `${hue} 70% ${tintFgL}`;

    const vars = {
        '--primary':                     primary,
        '--primary-hsl':                 `hsl(${hue}, ${saturation}%, ${lightness}%)`,
        '--primary-foreground':          fg,
        '--ring':                        ring,
        '--secondary':                   tint,
        '--secondary-foreground':        tintFg,
        '--accent':                      tint,
        '--accent-foreground':           tintFg,
        '--sidebar-primary':             ring,
        '--sidebar-primary-foreground':  '0 0% 100%',
        '--sidebar-ring':                ring,
        '--chat-bubble-sent':            primary,
        '--chat-bubble-sent-foreground': fg,
    };

    for (const [prop, value] of Object.entries(vars)) {
        root.style.setProperty(prop, value);
    }
}

function selectTheme(themeId) {
    const theme = getThemeById(themeId);
    localStorage.setItem(STORAGE_THEME, themeId);
    applyTheme(theme);
    updateSwatchSelection(themeId);
}

function loadSavedTheme() {
    selectTheme(localStorage.getItem(STORAGE_THEME) || DEFAULT_THEME_ID);
}

// ── Dark mode ─────────────────────────────────────────────────────

function applyMode(mode) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', mode === 'dark' || (mode === 'system' && prefersDark));
    // Re-apply theme so tints adjust for the new light/dark context
    applyTheme(getThemeById(localStorage.getItem(STORAGE_THEME) || DEFAULT_THEME_ID));
}

function selectMode(mode) {
    localStorage.setItem(STORAGE_MODE, mode);
    applyMode(mode);
    updateModeButtons(mode);
}

function loadSavedMode() {
    selectMode(localStorage.getItem(STORAGE_MODE) || 'system');
}

// Keep in sync when OS preference changes while mode is 'system'
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const mode = localStorage.getItem(STORAGE_MODE) || 'system';
    if (mode === 'system') applyMode('system');
});

// ── Panel open / close ────────────────────────────────────────────

function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'block';
    modal.offsetHeight; // force reflow so translateX(-100%) is in place before transition
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('show')));
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function handleSettingsModalClick(event) {
    if (event.target === document.getElementById('settingsModal')) closeSettings();
}

// ── Color swatches ────────────────────────────────────────────────

function buildColorSwatches() {
    const grid = document.getElementById('settingsColorGrid');
    if (!grid) return;

    const savedId = localStorage.getItem(STORAGE_THEME) || DEFAULT_THEME_ID;
    grid.innerHTML = '';

    THEMES.forEach(theme => {
        const color = themeHsl(theme);

        const swatch = Object.assign(document.createElement('div'), {
            className: 'settings-color-swatch' + (theme.id === savedId ? ' active' : ''),
            onclick: () => selectTheme(theme.id),
        });
        swatch.dataset.themeId = theme.id;
        swatch.style.setProperty('--swatch-color', color);

        const circle = Object.assign(document.createElement('div'), { className: 'settings-color-swatch-circle' });
        circle.style.background = color;

        const label = Object.assign(document.createElement('span'), {
            className: 'settings-color-swatch-label',
            textContent: theme.label,
        });

        swatch.append(circle, label);
        grid.appendChild(swatch);
    });
}

function updateSwatchSelection(themeId) {
    document.querySelectorAll('.settings-color-swatch').forEach(el => {
        el.classList.toggle('active', el.dataset.themeId === themeId);
    });
}

function updateModeButtons(mode) {
    document.querySelectorAll('.settings-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

// ── Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadSavedMode();
    loadSavedTheme();
    buildColorSwatches();
});
