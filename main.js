import './style.css';

import { subscribe, state, getSelectedTheme } from './src/core/state.js';
import { initMap, updateMapTheme, invalidateMapSize, waitForTilesLoad, waitForArtisticIdle, updateMarkerStyles, updateRouteStyles } from './src/map/map-init.js';
import { setupControls, updatePreviewStyles } from './src/ui/form.js';
import { exportToPNG } from './src/core/export.js';

const initialTheme = getSelectedTheme();
initMap('map-preview', [state.lat, state.lon], state.zoom, initialTheme.tileUrl);

const syncUI = setupControls();

const exportBtn = document.getElementById('export-btn');
const mobileExportBtn = document.getElementById('mobile-export-btn');
const posterContainer = document.getElementById('poster-container');

let _exportCheckInProgress = false;
const originalExportInner = exportBtn ? exportBtn.innerHTML : '';
let exportLoadingMode = null;

subscribe((currentState) => {
	if (currentState.renderMode === 'tile') {
		const theme = getSelectedTheme();
		const tileUrl = currentState.showLabels ? theme.tileUrl : theme.tileUrlNoLabels;
		updateMapTheme(tileUrl);
	}

	updatePreviewStyles(currentState);

	updateMarkerStyles(currentState);
	updateRouteStyles(currentState);

	syncUI(currentState);
	ensurePreviewReady();
});

function setExportButtonLoading(loading, mode = 'loading') {
	const buttons = [exportBtn, mobileExportBtn].filter(Boolean);
	if (loading && mode === 'loading' && exportLoadingMode === 'processing') return;

	if (loading) exportLoadingMode = mode; else exportLoadingMode = null;

	buttons.forEach(btn => {
		btn.disabled = !!loading;
		btn.setAttribute('aria-busy', loading ? 'true' : 'false');
		btn.classList.toggle('opacity-60', !!loading);
		btn.classList.toggle('cursor-not-allowed', !!loading);
	});

	if (exportBtn) {
		if (loading) {
			exportBtn.innerHTML = `
				<div class="flex items-center justify-center space-x-3">
					<div class="flex items-center space-x-1">
						<div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0s"></div>
						<div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
						<div class="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
					</div>
					<span>${mode === 'processing' ? 'Processing...' : 'Loading...'}</span>
				</div>
			`;
		} else {
			exportBtn.innerHTML = originalExportInner;
		}
	}

	if (mobileExportBtn) {
		if (loading) {
			mobileExportBtn.innerHTML = `<svg class="w-6 h-6 text-white animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
		} else {
			mobileExportBtn.innerHTML = `<svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`;
		}
	}
}

async function ensurePreviewReady() {
	if (_exportCheckInProgress) return;
	if (exportLoadingMode === 'processing') return;
	_exportCheckInProgress = true;
	try {
		setExportButtonLoading(true, 'loading');
		if (state.renderMode === 'artistic') {
			await waitForArtisticIdle(30000);
		} else {
			await waitForTilesLoad(30000);
		}
	} finally {
		setExportButtonLoading(false);
		_exportCheckInProgress = false;
	}
}

exportBtn.addEventListener('click', async () => {
	const filename = `MapToPoster-${state.city.replace(/\s+/g, '-')}-${Date.now()}.png`;
	setExportButtonLoading(true, 'processing');
	try {
		await exportToPNG(posterContainer, filename, null);
	} finally {
		setExportButtonLoading(false);
	}
});

mobileExportBtn?.addEventListener('click', async () => {
	const filename = `MapToPoster-${state.city.replace(/\s+/g, '-')}-${Date.now()}.png`;
	setExportButtonLoading(true, 'processing');
	try {
		await exportToPNG(posterContainer, filename, null);
	} finally {
		setExportButtonLoading(false);
	}
});

ensurePreviewReady();

window.addEventListener('resize', () => {
	updatePreviewStyles(state);
});

// --- ADMIN LOGIN LOGIC ---
const AUTHORIZED_USERS = [
	{ username: "pliztec", hash: "6c5f7e7f1bf208dc693630fbc0536c4ff5aa3fd2821d3cf5cd0d3a51f4961d36" }
	// Password is "pliztectomap"
];

let isAdminLoggedIn = false;

async function sha256(message) {
	const msgBuffer = new TextEncoder().encode(message);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const loginModal = document.getElementById('login-modal');
const loginForm = document.getElementById('login-form');
const closeLoginBtn = document.getElementById('close-login');
const loginOverlay = document.getElementById('login-overlay');
const systemLoginBtn = document.getElementById('system-login-btn');
const loginErrorMsg = document.getElementById('login-error');
const appWatermark = document.getElementById('app-watermark');

function openLogin() {
	loginErrorMsg.classList.add('hidden');
	loginModal.classList.add('show');
	document.getElementById('login-username').value = '';
	document.getElementById('login-password').value = '';
}

function closeLogin() {
	loginModal.classList.remove('show');
}

if (systemLoginBtn) {
	systemLoginBtn.addEventListener('click', (e) => {
		e.preventDefault();
		const creditsModal = document.getElementById('credits-modal');
		if (creditsModal) creditsModal.classList.remove('show');

		if (!isAdminLoggedIn) openLogin();
		else alert("You are already logged in!");
	});
}

if (closeLoginBtn) closeLoginBtn.addEventListener('click', closeLogin);
if (loginOverlay) loginOverlay.addEventListener('click', closeLogin);

if (loginForm) {
	loginForm.addEventListener('submit', async (e) => {
		e.preventDefault();
		loginErrorMsg.classList.add('hidden');

		const uInput = document.getElementById('login-username').value.trim();
		const pInput = document.getElementById('login-password').value;

		const currentHash = await sha256(pInput);

		const validUser = AUTHORIZED_USERS.find(u => u.username === uInput && u.hash === currentHash);

		if (validUser) {
			isAdminLoggedIn = true;
			if (appWatermark) appWatermark.style.display = 'none'; // Hide watermark
			closeLogin();
		} else {
			loginErrorMsg.classList.remove('hidden');
		}
	});
}
// -------------------------

setTimeout(invalidateMapSize, 500);
