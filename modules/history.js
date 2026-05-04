/**
 * Ice Encrypt v3.0 — History Module
 * Manages the local encryption/decryption history with full CRUD, search, and restore.
 */

import { escapeHtml, truncate, showToast, showConfirmModal } from './ui.js';

const STORAGE_KEY = 'iceEncryptHistory_v3';
const MAX_ITEMS = 75;

/* ==========================================================================
   State
   ========================================================================== */

let _history = [];
let _onChangeCallback = null;

/* ==========================================================================
   Lifecycle
   ========================================================================== */

export function initHistory(onChangeCallback) {
    _onChangeCallback = onChangeCallback;
    _load();
}

function _load() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) _history = JSON.parse(raw);
    } catch {
        _history = [];
    }
}

function _save() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_history));
    } catch {
        console.warn('Ice Encrypt: could not save history to localStorage.');
    }
    _onChangeCallback?.(_history.length);
}

/* ==========================================================================
   CRUD
   ========================================================================== */

export function addToHistory(type, input, output) {
    const item = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        type,        // 'encrypt' | 'decrypt'
        input,
        output,
        timestamp: Date.now(),
    };

    _history.unshift(item);

    if (_history.length > MAX_ITEMS) {
        _history = _history.slice(0, MAX_ITEMS);
    }

    _save();
    renderHistory();
}

export function deleteHistoryItem(id) {
    _history = _history.filter(h => h.id !== id);
    _save();
    renderHistory();
}

export async function clearAllHistory() {
    if (_history.length === 0) return;

    const confirmed = await showConfirmModal(
        'This will permanently delete all history entries. This action cannot be undone.',
        'Clear All',
        true
    );

    if (!confirmed) return;

    _history = [];
    _save();
    renderHistory();
    showToast('Cleared', 'All history has been deleted.', 'info');
}

export function getHistoryCount() {
    return _history.length;
}

/* ==========================================================================
   Rendering
   ========================================================================== */

export function renderHistory(filterText = '') {
    const listEl = document.getElementById('historyList');
    if (!listEl) return;

    if (_history.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <p>No history yet.</p>
                <span>Start encrypting or decrypting to see entries here.</span>
            </div>`;
        return;
    }

    const lower = filterText.toLowerCase();
    const filtered = _history.filter(h =>
        !lower ||
        h.input.toLowerCase().includes(lower) ||
        h.output.toLowerCase().includes(lower) ||
        h.type.includes(lower)
    );

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="empty-state"><p>No results for "${escapeHtml(filterText)}"</p></div>`;
        return;
    }

    listEl.innerHTML = filtered.map(h => _renderItem(h)).join('');

    // Attach event listeners via delegation
    listEl.querySelectorAll('.hist-action').forEach(btn => {
        const id = btn.closest('.history-item')?.dataset.id;
        const action = btn.dataset.action;
        if (!id || !action) return;
        btn.addEventListener('click', () => _handleAction(action, id));
    });
}

function _renderItem(h) {
    const date = new Date(h.timestamp);
    const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' · ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

    const isFile = h.input.startsWith('File:');
    const icon = h.type === 'encrypt' ? '🔐' : '🔓';
    const typeLabel = h.type === 'encrypt' ? 'Encrypted' : 'Decrypted';

    return `
        <div class="history-item" data-id="${escapeHtml(h.id)}">
            <div class="hist-header">
                <div class="hist-type ${h.type}">
                    <span>${icon}</span>
                    <span>${typeLabel}</span>
                </div>
                <div class="hist-meta">
                    <span class="hist-time">${timeStr}</span>
                    <div class="hist-actions-row">
                        ${!isFile ? `
                        <button class="hist-action icon-btn" data-action="load" title="Load into input">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h12"/></svg>
                        </button>
                        <button class="hist-action icon-btn" data-action="copy" title="Copy output">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>` : ''}
                        <button class="hist-action icon-btn danger" data-action="delete" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        </button>
                    </div>
                </div>
            </div>
            <div class="hist-content">
                <div class="hist-field">
                    <span class="hist-label">Input</span>
                    <div class="hist-val">${escapeHtml(truncate(h.input, 200))}</div>
                </div>
                <div class="hist-field">
                    <span class="hist-label">Output</span>
                    <div class="hist-val mono">${escapeHtml(truncate(h.output, 200))}</div>
                </div>
            </div>
        </div>
    `;
}

function _handleAction(action, id) {
    const item = _history.find(h => h.id === id);
    if (!item) return;

    if (action === 'delete') {
        deleteHistoryItem(id);
    } else if (action === 'copy') {
        navigator.clipboard.writeText(item.output)
            .then(() => showToast('Copied', 'Output copied to clipboard.', 'success'))
            .catch(() => showToast('Failed', 'Could not copy to clipboard.', 'error'));
    } else if (action === 'load') {
        const textInput = document.getElementById('textInput');
        if (textInput) {
            textInput.value = item.input;
            textInput.dispatchEvent(new Event('input'));
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
            showToast('Loaded', 'Input restored from history.', 'info');
        }
    }
}
