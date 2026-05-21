// Dark Mode Toggle (removed but keep compatibility)
const darkModeToggle = document.getElementById('darkModeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');

// Only run if elements exist
if (darkModeToggle && sunIcon && moonIcon) {
    // Load saved dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    if (savedDarkMode) {
        document.body.classList.add('dark-mode');
        sunIcon.classList.add('hidden');
        moonIcon.classList.remove('hidden');
    }

    // Toggle dark mode
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
        // Toggle icons
        sunIcon.classList.toggle('hidden', isDark);
        moonIcon.classList.toggle('hidden', !isDark);
        
        // Save preference
        localStorage.setItem('darkMode', isDark);
    });
}

// Language Switching
const langBtn = document.getElementById('langBtn');
const langMenu = document.getElementById('langMenu');
const langText = document.getElementById('langText');
const langFlag = document.getElementById('langFlag');
const langOptions = document.querySelectorAll('.lang-option');

let currentLang = 'en';

// Toggle language menu
langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langMenu.classList.toggle('hidden');
    langBtn.classList.toggle('active');
});

// Close menu when clicking outside
document.addEventListener('click', () => {
    langMenu.classList.add('hidden');
    langBtn.classList.remove('active');
});

// Language option click
langOptions.forEach(option => {
    option.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = option.dataset.lang;
        const flag = option.dataset.flag;
        switchLanguage(lang, flag);
        langMenu.classList.add('hidden');
        langBtn.classList.remove('active');
    });
});

function switchLanguage(lang, flag) {
    currentLang = lang;
    
    // Update HTML attributes
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.body.dir = lang === 'ar' ? 'rtl' : 'ltr';
    
    // Update button text and flag
    langText.textContent = lang === 'en' ? 'English' : 'العربية';
    langFlag.textContent = flag;
    
    // Update active state
    langOptions.forEach(opt => {
        const isActive = opt.dataset.lang === lang;
        opt.classList.toggle('active', isActive);
        opt.querySelector('.checkmark').classList.toggle('hidden', !isActive);
    });
    
    // Update all translatable elements
    document.querySelectorAll('[data-ar]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
            if (el.tagName === 'INPUT') {
                el.placeholder = text;
            } else {
                el.textContent = text;
            }
        }
    });
    
    // Update placeholder separately
    const urlInput = document.getElementById('videoUrl');
    if (urlInput) {
        urlInput.placeholder = lang === 'en' 
            ? urlInput.getAttribute('data-placeholder-en')
            : urlInput.getAttribute('data-placeholder-ar');
    }
    
    // Save preference
    localStorage.setItem('preferredLanguage', lang);
}

// Load saved language preference - Default to English
const savedLang = localStorage.getItem('preferredLanguage') || 'en';
const savedFlag = savedLang === 'en' ? '🇺🇸' : '🇪🇬';

// Force English as default on first load
if (!localStorage.getItem('preferredLanguage')) {
    localStorage.setItem('preferredLanguage', 'en');
}

switchLanguage(savedLang, savedFlag);

// API Base URL - static hosts (GitHub Pages / Firebase) use Railway backend
const DEFAULT_PRODUCTION_API_BASE = 'https://vitro1-production-be78.up.railway.app';
const normalizeApiBase = (value) => String(value || '').trim().replace(/\/+$/, '');
const configuredApiBase = normalizeApiBase(
    window.VITRO_API_BASE_URL || localStorage.getItem('VITRO_API_BASE_URL')
);
const hostname = window.location.hostname;
const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
const isPrivateLan = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(hostname);

// Default to Railway production URL for Firebase / GitHub Pages hosting
const API_BASE_URL = configuredApiBase || (
    isLocalHost
        ? 'http://localhost:3001'
        : isPrivateLan
            ? window.location.origin
            : DEFAULT_PRODUCTION_API_BASE
);
const LOCAL_API_BASE = 'http://localhost:3001';
let activeApiBase = API_BASE_URL;

function isInstagramUrl(url) {
    return /instagram\.com/i.test(url);
}

function isYoutubeUrl(url) {
    return /youtube\.com|youtu\.be/i.test(url);
}

function isYoutubeBackendError(message) {
    return /authentication|blocked|Sign in|cookies|not a bot/i.test(String(message || ''));
}

function parseLanFromPageUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('api') || params.get('lan');
    if (!raw) return null;
    if (raw.includes('://')) return normalizeApiBase(raw);
    const host = raw.replace(/:\d+$/, '');
    return `http://${host}:3001`;
}

function getLanApiCandidates() {
    const fromQuery = parseLanFromPageUrl();
    const saved = normalizeApiBase(localStorage.getItem('VITRO_LAN_API'));
    const defaults = ['http://192.168.1.3:3001', 'http://192.168.0.3:3001', 'http://192.168.1.2:3001'];
    return [...new Set([fromQuery, saved, ...defaults].filter(Boolean))];
}

async function isApiAvailable(apiBase, options = {}) {
    const { needInstagram = false } = options;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`${apiBase}/health`, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.version) return false;
        if (needInstagram && !data.instagramCookies) return false;
        return true;
    } catch {
        return false;
    }
}

async function isLocalServerAvailable() {
    return isApiAvailable(LOCAL_API_BASE);
}

async function findLanBackend(needInstagram = false) {
    if (isLocalHost || isPrivateLan) return null;

    for (const base of getLanApiCandidates()) {
        if (await isApiAvailable(base, { needInstagram })) {
            localStorage.setItem('VITRO_LAN_API', base);
            console.log('Using LAN backend:', base);
            return base;
        }
    }
    return null;
}

async function resolveApiBase(url) {
    if (isLocalHost || isPrivateLan) return API_BASE_URL;
    if (!isInstagramUrl(url)) return API_BASE_URL;

    const lanApi = await findLanBackend(true);
    if (lanApi) return lanApi;

    return API_BASE_URL;
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function setupMobileLanHint() {
    if (isLocalHost || isPrivateLan || !isMobileDevice()) return;
    if (API_BASE_URL !== DEFAULT_PRODUCTION_API_BASE) return;

    const saved = localStorage.getItem('VITRO_LAN_API');
    const hero = document.querySelector('.hero-download-tool') || document.querySelector('.hero-content');
    if (!hero || document.getElementById('mobileLanHint')) return;

    const box = document.createElement('div');
    box.id = 'mobileLanHint';
    box.className = 'mobile-lan-hint';
    box.innerHTML = currentLang === 'ar'
        ? `<strong>إنستجرام من الموبايل:</strong> افتح موقع اللابتوب على نفس الواي فاي<br>
           <a href="http://192.168.1.3:3001">http://192.168.1.3:3001</a>
           <span class="lan-hint-or">أو</span>
           <input type="text" id="lanIpInput" placeholder="192.168.1.3" value="${saved ? saved.replace('http://', '').replace(':3001', '') : '192.168.1.3'}">
           <button type="button" id="lanIpSaveBtn">ربط اللابتوب</button>`
        : `<strong>Instagram on phone:</strong> use your laptop server on same Wi‑Fi<br>
           <a href="http://192.168.1.3:3001">http://192.168.1.3:3001</a>
           <span class="lan-hint-or">or</span>
           <input type="text" id="lanIpInput" placeholder="192.168.1.3" value="${saved ? saved.replace('http://', '').replace(':3001', '') : '192.168.1.3'}">
           <button type="button" id="lanIpSaveBtn">Link laptop</button>`;

    hero.parentNode.insertBefore(box, hero);

    document.getElementById('lanIpSaveBtn').addEventListener('click', async () => {
        const ip = document.getElementById('lanIpInput').value.trim().replace(/^https?:\/\//, '').replace(/:\d+$/, '');
        if (!ip) return;
        const base = `http://${ip}:3001`;
        localStorage.setItem('VITRO_LAN_API', base);
        const ok = await isApiAvailable(base, { needInstagram: true });
        showError(ok
            ? (currentLang === 'ar' ? '✓ تم ربط اللابتوب. جرّب التحميل الآن.' : '✓ Laptop linked. Try download now.')
            : (currentLang === 'ar' ? 'لم يتم العثور على السيرفر. تأكد أن npm start شغال على اللابتوب.' : 'Server not found. Ensure npm start is running on laptop.'));
        if (ok) box.classList.add('linked');
    });
}

const lanFromUrl = parseLanFromPageUrl();
if (lanFromUrl) {
    localStorage.setItem('VITRO_LAN_API', lanFromUrl);
}
setupMobileLanHint();

async function checkProductionBackend() {
    if (isLocalHost || API_BASE_URL !== DEFAULT_PRODUCTION_API_BASE) return;
    try {
        const res = await fetch(`${DEFAULT_PRODUCTION_API_BASE}/health`);
        const data = await res.json();
        if (!data.version) {
            console.warn('Railway backend is outdated — Redeploy required in Railway dashboard');
        }
    } catch (err) {
        console.warn('Production backend unreachable:', err.message);
    }
}

checkProductionBackend();

// عناصر الصفحة
const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const pasteBtn = document.getElementById('pasteBtn');
const pasteTooltip = document.getElementById('pasteTooltip');
const statusMessage = document.getElementById('statusMessage');
const resultSection = document.getElementById('resultSection');
const downloadLink = document.getElementById('downloadLink');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

function updateProgress(progress, message) {
    const pct = Math.min(100, Math.max(0, Number(progress) || 0));
    progressFill.style.width = `${pct}%`;
    if (message) {
        progressText.textContent = message;
    }
}

// Translations for dynamic messages
const translations = {
    en: {
        enterUrl: 'Please enter a video URL',
        enterValidUrl: 'Please enter a valid URL (must start with http:// or https://)',
        downloading: 'Downloading video...',
        analyzing: 'Analyzing link...',
        preparing: 'Preparing video...',
        almostDone: 'Almost done...',
        errorOccurred: 'An error occurred while processing the video',
        tryAgain: 'Please try again',
        pasteFailed: 'Failed to paste from clipboard',
        pasteSuccess: 'Link pasted successfully!',
        noClipboard: 'No link found in clipboard',
        pasteManual: 'Please use Ctrl+V to paste the link'
    },
    ar: {
        enterUrl: 'الرجاء إدخال رابط الفيديو',
        enterValidUrl: 'الرجاء إدخال رابط صحيح (يجب أن يبدأ بـ http:// أو https://)',
        downloading: 'جاري تحميل الفيديو...',
        analyzing: 'جاري تحليل الرابط...',
        preparing: 'جاري تجهيز الفيديو...',
        almostDone: 'أوشكنا على الانتهاء...',
        errorOccurred: 'حدث خطأ أثناء معالجة الفيديو',
        tryAgain: 'الرجاء المحاولة مرة أخرى',
        pasteFailed: 'فشل اللصق من الحافظة',
        pasteSuccess: 'تم لصق الرابط بنجاح!',
        noClipboard: 'لا يوجد رابط في الحافظة',
        pasteManual: 'الرجاء استخدام Ctrl+V للصق الرابط'
    }
};

function t(key) {
    return translations[currentLang][key] || key;
}

// Event handlers
console.log('Setting up event listeners...');
console.log('downloadBtn:', downloadBtn);
console.log('videoUrlInput:', videoUrlInput);

downloadBtn.addEventListener('click', handleDownload);

// زر اللصق
pasteBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // التركيز على الحقل أولاً
    videoUrlInput.focus();
    
    try {
        // محاولة قراءة من الحافظة
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
            videoUrlInput.value = text.trim();
            
            // تأثير بصري للنجاح
            pasteBtn.style.color = '#10b981';
            pasteBtn.style.transform = 'translateY(-50%) scale(1.2)';
            setTimeout(() => {
                pasteBtn.style.color = '';
                pasteBtn.style.transform = '';
            }, 300);
        }
    } catch (error) {
        // إذا فشل، نحاول طريقة بديلة
        const currentValue = videoUrlInput.value;
        videoUrlInput.select();
        document.execCommand('paste');
        
        if (videoUrlInput.value !== currentValue) {
            pasteBtn.style.color = '#10b981';
            setTimeout(() => {
                pasteBtn.style.color = '';
            }, 300);
        }
    }
});

// إظهار tooltip عند التركيز على حقل الإدخال
videoUrlInput.addEventListener('focus', async () => {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text && text.trim() && text.startsWith('http')) {
                pasteTooltip.textContent = text;
                pasteTooltip.classList.remove('hidden');
                setTimeout(() => {
                    pasteTooltip.classList.add('show');
                }, 10);
            }
        }
    } catch (error) {
        // تجاهل الأخطاء
    }
});

// إخفاء tooltip عند فقدان التركيز أو الكتابة
videoUrlInput.addEventListener('blur', () => {
    pasteTooltip.classList.remove('show');
    setTimeout(() => {
        pasteTooltip.classList.add('hidden');
    }, 300);
});

videoUrlInput.addEventListener('input', () => {
    pasteTooltip.classList.remove('show');
    setTimeout(() => {
        pasteTooltip.classList.add('hidden');
    }, 300);
});

videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleDownload();
    }
});

videoUrlInput.addEventListener('input', () => {
    hideMessages();
});

// Main download function
async function handleDownload() {
    console.log('Download button clicked!');
    const url = videoUrlInput.value.trim();
    console.log('URL:', url);
    
    if (!url) {
        showError(t('enterUrl'));
        return;
    }
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        showError(t('enterValidUrl'));
        return;
    }
    
    startProcessing();
    activeApiBase = await resolveApiBase(url);
    console.log('Starting download request...', activeApiBase);
    
    try {
        const response = await fetch(`${activeApiBase}/api/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        
        console.log('Response received:', response.status);
        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
            data = await response.json();
            console.log('Data:', data);
        } else {
            const rawText = await response.text();
            console.error('Non-JSON response preview:', rawText.slice(0, 180));

            if (response.status === 404 && activeApiBase === window.location.origin) {
                showError(currentLang === 'ar'
                    ? 'خدمة التحميل غير متصلة. تأكد أن السيرفر يعمل.'
                    : 'Download service is not connected. Make sure the server is running.');
                return;
            }

            showError(`Server response is invalid (${response.status})`);
            return;
        }

        if (!response.ok) {
            showError(data?.error || t('tryAgain'));
            return;
        }
        
        if (data?.success && data?.downloadId) {
            // Use fast fake progress and listen in background
            listenToProgressBackground(data.downloadId, activeApiBase);
        } else {
            showError(data.error || t('errorOccurred'));
        }
        
    } catch (error) {
        console.error('Download error:', error);
        showError(t('tryAgain'));
    }
}

const DOWNLOAD_TIMEOUT_MS = 4 * 60 * 1000;

// Listen to SSE in background without showing slow progress
function listenToProgressBackground(downloadId, apiBase = activeApiBase) {
    console.log('Connecting to SSE for downloadId:', downloadId, apiBase);
    const eventSource = new EventSource(`${apiBase}/api/progress/${downloadId}`);
    let finished = false;

    const timeoutId = setTimeout(() => {
        if (finished) return;
        finished = true;
        eventSource.close();
        if (window.progressInterval) {
            clearInterval(window.progressInterval);
        }
        showError(
            currentLang === 'ar'
                ? 'انتهى الوقت. تأكد من كوكيز Facebook أو جرّب رابطاً آخر.'
                : 'Timed out. Check Facebook cookies or try another link.'
        );
    }, DOWNLOAD_TIMEOUT_MS);
    
    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            console.log('Progress event:', data);
            
            if (data.type === 'connected') {
                console.log('Connected to progress stream');
            } else if (data.type === 'progress') {
                // Stop fake animation and show real progress
                if (window.progressInterval) {
                    clearInterval(window.progressInterval);
                    window.progressInterval = null;
                }
                // Check if progress data exists
                if (data.progress !== undefined && data.message) {
                    updateProgress(data.progress, data.message);
                } else {
                    console.log('Progress data incomplete:', data);
                }
            } else if (data.type === 'complete') {
                console.log('Download complete!', data);
                finished = true;
                clearTimeout(timeoutId);
                eventSource.close();
                // Stop fake animation
                if (window.progressInterval) {
                    clearInterval(window.progressInterval);
                }
                showSuccess(data.downloadUrl, data.filename, apiBase);
            } else if (data.type === 'error') {
                console.log('Download error:', data.message);
                finished = true;
                clearTimeout(timeoutId);
                eventSource.close();
                if (window.progressInterval) {
                    clearInterval(window.progressInterval);
                }
                const url = videoUrlInput.value.trim();
                if (apiBase !== LOCAL_API_BASE && isYoutubeUrl(url) && isYoutubeBackendError(data.message)) {
                    retryDownloadViaLocalhost(url, data.message);
                    return;
                }
                if (isInstagramUrl(url) && apiBase === DEFAULT_PRODUCTION_API_BASE) {
                    retryDownloadViaLan(url, data.message);
                    return;
                }
                showYoutubeDeployError(data.message);
            }
        } catch (err) {
            console.error('Error parsing SSE data:', err);
        }
    };
    
    eventSource.onerror = (error) => {
        console.error('SSE error:', error);
        if (eventSource.readyState === EventSource.CLOSED && !finished) {
            finished = true;
            clearTimeout(timeoutId);
            eventSource.close();
            if (window.progressInterval) {
                clearInterval(window.progressInterval);
            }
            showError(t('tryAgain'));
        }
    };
}

async function retryDownloadViaLan(url, originalError) {
    updateProgress(15, currentLang === 'ar' ? 'الاتصال بسيرفر اللابتوب...' : 'Connecting to laptop server...');
    const lanApi = await findLanBackend(true);
    if (!lanApi) {
        showError(
            currentLang === 'ar'
                ? 'إنستجرام من الموبايل يحتاج سيرفر اللابتوب. افتح http://192.168.1.3:3001 على نفس الواي فاي، أو اربط IP اللابتوب أعلاه.'
                : 'Instagram on phone needs the laptop server. Open http://192.168.1.3:3001 on same Wi‑Fi, or link laptop IP above.'
        );
        return;
    }

    activeApiBase = lanApi;
    try {
        const response = await fetch(`${lanApi}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (response.ok && data?.success && data?.downloadId) {
            listenToProgressBackground(data.downloadId, lanApi);
            return;
        }
        showError(data?.error || originalError);
    } catch (err) {
        console.error('LAN fallback failed:', err);
        showError(originalError || t('tryAgain'));
    }
}

async function retryDownloadViaLocalhost(url, originalError) {
    updateProgress(10, currentLang === 'ar' ? 'تجربة السيرفر المحلي...' : 'Trying local server...');
    const localOk = await isLocalServerAvailable();
    if (!localOk) {
        showYoutubeDeployError(originalError);
        return;
    }

    console.log('Falling back to local server:', LOCAL_API_BASE);
    activeApiBase = LOCAL_API_BASE;
    try {
        const response = await fetch(`${LOCAL_API_BASE}/api/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await response.json();
        if (response.ok && data?.success && data?.downloadId) {
            listenToProgressBackground(data.downloadId, LOCAL_API_BASE);
            return;
        }
    } catch (err) {
        console.error('Local fallback failed:', err);
    }
    showYoutubeDeployError(originalError);
}

function isFacebookOrInstagramError(message) {
    return /facebook|instagram|cookies|sessionid|ffmpeg version/i.test(String(message || ''));
}

function showYoutubeDeployError(message) {
    if (isFacebookOrInstagramError(message) && API_BASE_URL === DEFAULT_PRODUCTION_API_BASE) {
        showError(
            currentLang === 'ar'
                ? 'فيسبوك وإنستجرام على الموقع يحتاجان كوكيز على Railway. شغّل scripts/export-railway-all-cookies.ps1 ثم Redeploy.'
                : 'Facebook/Instagram on the live site need cookies on Railway. Run export-railway-all-cookies.ps1 then Redeploy.'
        );
        return;
    }
    if (isYoutubeBackendError(message) && API_BASE_URL === DEFAULT_PRODUCTION_API_BASE) {
        showError(
            currentLang === 'ar'
                ? 'سيرفر Railway قديم. شغّل السيرفر محلياً (npm start) أو اعمل Redeploy على Railway.'
                : 'Railway server is outdated. Run npm start locally or Redeploy on Railway.'
        );
        return;
    }
    showError(message || t('errorOccurred'));
}

console.log('Vitro API:', API_BASE_URL);

// Fast fake animation
function startFastAnimation() {
    let progress = 0;
    progressFill.style.width = '0%';
    progressText.textContent = t('analyzing');
    
    window.progressInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 95) progress = 95;
        
        const roundedProgress = Math.round(progress);
        progressFill.style.width = `${roundedProgress}%`;
        
        let statusText = '';
        if (progress < 30) {
            statusText = t('analyzing');
        } else if (progress < 70) {
            statusText = t('downloading');
        } else {
            statusText = t('preparing');
        }
        
        progressText.textContent = statusText;
    }, 150);
}

// UI state management
function startProcessing() {
    downloadBtn.disabled = true;
    downloadBtn.textContent = t('downloading');
    videoUrlInput.disabled = true;
    
    resultSection.classList.add('hidden');
    statusMessage.classList.add('hidden');
    
    // Show Progress Bar with fast animation
    progressContainer.classList.remove('hidden');
    startFastAnimation();
}

function showSuccess(downloadUrl, filename, apiBase = activeApiBase) {
    downloadBtn.disabled = false;
    downloadBtn.textContent = currentLang === 'en' ? 'Download Video' : 'تحميل الفيديو';
    videoUrlInput.disabled = false;
    
    // Clear progress animation
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
    }
    
    // Complete progress bar
    progressFill.style.width = '100%';
    progressText.textContent = currentLang === 'ar' ? 'التحميل جاهز!' : 'Download ready!';
    
    setTimeout(() => {
        progressContainer.classList.add('hidden');
    }, 1000);
    
    statusMessage.classList.add('hidden');
    
    // Check if downloadUrl exists and is valid
    if (downloadUrl) {
        const fullUrl = downloadUrl.startsWith('http') ? downloadUrl : `${apiBase}${downloadUrl}`;
        downloadLink.href = fullUrl;
        if (filename) {
            downloadLink.download = filename;
        }
        
        resultSection.classList.remove('hidden');
        
        // Auto-download the video immediately
        setTimeout(() => {
            downloadLink.click();
            console.log('Auto-downloading video...');
        }, 500);
    } else {
        showError(t('errorOccurred'));
    }
}

function showError(message) {
    downloadBtn.disabled = false;
    downloadBtn.textContent = currentLang === 'en' ? 'Download Video' : 'تحميل الفيديو';
    videoUrlInput.disabled = false;
    
    // Clear progress animation
    if (window.progressInterval) {
        clearInterval(window.progressInterval);
    }
    
    // Hide progress bar
    progressContainer.classList.add('hidden');
    
    resultSection.classList.add('hidden');
    
    statusMessage.classList.remove('hidden', 'processing');
    statusMessage.classList.add('error');
    statusMessage.textContent = `❌ ${message}`;
    
    setTimeout(() => {
        statusMessage.classList.add('hidden');
    }, 6000);
}

function hideMessages() {
    statusMessage.classList.add('hidden');
    resultSection.classList.add('hidden');
}


// Feedback functionality
const feedbackText = document.getElementById('feedbackText');
const submitFeedback = document.getElementById('submitFeedback');
const feedbackMessage = document.getElementById('feedbackMessage');
const reviewsList = document.getElementById('reviewsList');
const starBtns = document.querySelectorAll('.star-btn');

let selectedRating = 0;

// Star rating selection
starBtns.forEach(star => {
    star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.rating);
        updateStarDisplay();
    });
    
    star.addEventListener('mouseenter', () => {
        const rating = parseInt(star.dataset.rating);
        starBtns.forEach((s, index) => {
            s.style.opacity = index < rating ? '1' : '0.3';
        });
    });
});

document.querySelector('.star-rating').addEventListener('mouseleave', () => {
    updateStarDisplay();
});

function updateStarDisplay() {
    starBtns.forEach((star, index) => {
        if (index < selectedRating) {
            star.classList.add('active');
            star.style.opacity = '1';
        } else {
            star.classList.remove('active');
            star.style.opacity = '0.3';
        }
    });
}

// Load reviews from localStorage
function loadReviews() {
    const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    displayReviews(reviews);
}

// Display reviews
function displayReviews(reviews) {
    if (reviews.length === 0) {
        reviewsList.innerHTML = `<p class="no-reviews" data-en="No reviews yet. Be the first to review!" data-ar="لا توجد تقييمات بعد. كن أول من يقيم!">No reviews yet. Be the first to review!</p>`;
        return;
    }
    
    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-card">
            <div class="review-header">
                <div class="review-user">
                    <div class="user-avatar">${review.userName.charAt(0).toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name">${review.userName}</div>
                        <div class="review-date">${review.date}</div>
                    </div>
                </div>
                <div class="review-stars">
                    ${'⭐'.repeat(review.rating)}
                </div>
            </div>
            <p class="review-text">${review.text}</p>
        </div>
    `).join('');
}

submitFeedback.addEventListener('click', async () => {
    const feedback = feedbackText.value.trim();
    
    if (!selectedRating) {
        showFeedbackMessage(
            currentLang === 'en' ? 'Please select a rating' : 'الرجاء اختيار تقييم',
            'error'
        );
        return;
    }
    
    if (!feedback) {
        showFeedbackMessage(
            currentLang === 'en' ? 'Please enter your review' : 'الرجاء كتابة تقييمك',
            'error'
        );
        return;
    }
    
    // Generate random user name
    const userName = 'User' + Math.floor(Math.random() * 10000);
    const date = new Date().toLocaleDateString(currentLang === 'ar' ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const newReview = {
        userName,
        rating: selectedRating,
        text: feedback,
        date,
        timestamp: Date.now()
    };
    
    // Save to localStorage
    const reviews = JSON.parse(localStorage.getItem('reviews') || '[]');
    reviews.unshift(newReview);
    localStorage.setItem('reviews', JSON.stringify(reviews));
    
    // Display updated reviews
    displayReviews(reviews);
    
    // Reset form
    feedbackText.value = '';
    selectedRating = 0;
    updateStarDisplay();
    
    showFeedbackMessage(
        currentLang === 'en' ? '✓ Thank you for your review!' : '✓ شكراً لك على تقييمك!',
        'success'
    );
    
    // Scroll to reviews
    setTimeout(() => {
        reviewsList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 500);
});

function showFeedbackMessage(message, type) {
    feedbackMessage.textContent = message;
    feedbackMessage.className = `feedback-message ${type}`;
    feedbackMessage.classList.remove('hidden');
    
    setTimeout(() => {
        feedbackMessage.classList.add('hidden');
    }, 5000);
}

// Update feedback placeholder on language change
const originalSwitchLanguage = switchLanguage;
switchLanguage = function(lang, flag) {
    originalSwitchLanguage(lang, flag);
    
    if (feedbackText) {
        feedbackText.placeholder = lang === 'en' 
            ? feedbackText.getAttribute('data-placeholder-en')
            : feedbackText.getAttribute('data-placeholder-ar');
    }
};

// Load reviews on page load
loadReviews();
