/**
 * Ice Encrypt v3.0 — Shared UI Module
 * Handles: theme, toast notifications, nav, confirmation modal
 */

/* ==========================================================================
   Theme Management
   ========================================================================== */

export function loadTheme() {
    const saved = localStorage.getItem('iceEncrypt_darkMode');
    // Default to dark if never set
    const isDark = saved === null ? true : saved === 'true';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
}

export function toggleTheme() {
    const isDark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    localStorage.setItem('iceEncrypt_darkMode', isDark);
}

/* ==========================================================================
   Navigation (hamburger + theme btn — shared across pages)
   ========================================================================== */

export function initNav() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const hamburger = document.getElementById('navHamburger');
    const navLinks = document.getElementById('navLinks');

    themeBtn?.addEventListener('click', toggleTheme);

    hamburger?.addEventListener('click', () => {
        const open = hamburger.getAttribute('aria-expanded') === 'true';
        hamburger.setAttribute('aria-expanded', String(!open));
        navLinks?.classList.toggle('open', !open);
    });

    // Close mobile nav on outside click
    document.addEventListener('click', (e) => {
        if (hamburger && navLinks &&
            !hamburger.contains(e.target) &&
            !navLinks.contains(e.target)) {
            hamburger.setAttribute('aria-expanded', 'false');
            navLinks.classList.remove('open');
        }
    });
}

/* ==========================================================================
   Toast Notification System
   ========================================================================== */

const TOAST_DURATION = 4500;

const TOAST_ICONS = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

export function showToast(title, message = '', type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    toast.innerHTML = `
        ${TOAST_ICONS[type] || TOAST_ICONS.info}
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            ${message ? `<div class="toast-msg">${escapeHtml(message)}</div>` : ''}
        </div>
        <button class="toast-close" aria-label="Close notification" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    container.appendChild(toast);

    // Trigger entry animation next frame
    requestAnimationFrame(() => toast.classList.add('visible'));

    const removeToast = () => {
        toast.classList.remove('visible');
        toast.classList.add('hiding');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    };

    toast.querySelector('.toast-close').addEventListener('click', removeToast);
    const timer = setTimeout(removeToast, TOAST_DURATION);

    // Pause auto-dismiss on hover
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => setTimeout(removeToast, 1500));
}

/* ==========================================================================
   Confirmation Modal
   ========================================================================== */

let modalResolve = null;

export function showConfirmModal(message, confirmText = 'Confirm', isDangerous = false) {
    return new Promise((resolve) => {
        modalResolve = resolve;

        let modal = document.getElementById('confirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'confirmModal';
            modal.className = 'modal-overlay';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'modal-title');
            modal.innerHTML = `
                <div class="modal-box">
                    <div class="modal-icon" id="modal-icon"></div>
                    <h2 class="modal-title" id="modal-title">Are you sure?</h2>
                    <p class="modal-msg" id="modal-msg"></p>
                    <div class="modal-actions">
                        <button class="btn btn-ghost" id="modal-cancel" type="button">Cancel</button>
                        <button class="btn btn-primary" id="modal-confirm" type="button">${escapeHtml(confirmText)}</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('modal-cancel').addEventListener('click', () => resolveModal(false));
            document.getElementById('modal-confirm').addEventListener('click', () => resolveModal(true));
            modal.addEventListener('click', (e) => { if (e.target === modal) resolveModal(false); });
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('active')) resolveModal(false); });
        }

        const confirmBtn = document.getElementById('modal-confirm');
        const iconEl = document.getElementById('modal-icon');
        confirmBtn.textContent = confirmText;
        confirmBtn.className = `btn ${isDangerous ? 'btn-danger-solid' : 'btn-primary'}`;

        iconEl.innerHTML = isDangerous
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
        iconEl.className = `modal-icon ${isDangerous ? 'danger' : 'info'}`;

        document.getElementById('modal-msg').textContent = message;
        modal.classList.add('active');

        // Focus the cancel button for safety (keyboard users)
        requestAnimationFrame(() => document.getElementById('modal-cancel').focus());
    });
}

function resolveModal(value) {
    const modal = document.getElementById('confirmModal');
    if (modal) modal.classList.remove('active');
    if (modalResolve) {
        modalResolve(value);
        modalResolve = null;
    }
}

/* ==========================================================================
   Utility: HTML escape
   ========================================================================== */

export function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function truncate(str, max) {
    return str.length > max ? str.substring(0, max) + '…' : str;
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
