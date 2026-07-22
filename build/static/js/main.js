/**
 * AI Poem Generator - Main JavaScript
 * Handles poem generation, API calls, and result display
 */

// Global configuration
const DOMAIN_CONFIG = {
    API_BASE: 'https://api.playpokechill.blog',
    FRONTEND_BASE: window.location.origin
};

const API_ENDPOINTS = {
    BASE: `${DOMAIN_CONFIG.API_BASE}/api`,
    POEM: {
        GENERATE: `${DOMAIN_CONFIG.API_BASE}/api/poem/generate`,
        QUOTA: `${DOMAIN_CONFIG.API_BASE}/api/poem/quota`,
        HEALTH: `${DOMAIN_CONFIG.API_BASE}/api/poem/health`
    }
};

window.DOMAIN_CONFIG = DOMAIN_CONFIG;
window.API_ENDPOINTS = API_ENDPOINTS;

// Language configuration
const SUPPORTED_LANGUAGES = ['en'];
const DEFAULT_LANGUAGE = 'en';

function getCurrentLanguage() {
    const docLang = document.documentElement.lang;
    if (docLang && SUPPORTED_LANGUAGES.includes(docLang)) {
        return docLang;
    }
    return DEFAULT_LANGUAGE;
}

window.getCurrentLanguage = getCurrentLanguage;

/**
 * AI Poem Generator Class
 */
class PoemGenerator {
    constructor() {
        this.poemInput = document.getElementById('lyricsInput');
        this.styleSelect = document.getElementById('styleSelect');
        this.moodSelect = document.getElementById('moodSelect');
        this.generateBtn = document.getElementById('generateBtn');
        this.trySampleBtn = document.getElementById('trySampleBtn');
        
        this.previewDefault = document.getElementById('previewDefault');
        this.previewLoading = document.getElementById('previewLoading');
        this.previewResult = document.getElementById('previewResult');
        this.generatedPoem = document.getElementById('generatedLyrics');
        this.resultTitle = document.getElementById('resultTitle');
        
        this.copyBtn = document.getElementById('copyBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.regenerateBtn = document.getElementById('regenerateBtn');
        
        this.lang = getCurrentLanguage();
        this.lastRequest = null;
        
        // Get sample ideas from translations or use defaults
        const translations = window.FRONTEND_TRANSLATIONS?.[this.lang] || window.FRONTEND_TRANSLATIONS?.en || {};
        this.sampleIdeas = translations.sampleIdeas || [
            "Write a love poem about the ocean and endless waves.",
            "Create an acrostic poem using the word HOPE.",
            "Write a haiku about autumn leaves falling.",
            "Create a sonnet about the beauty of a sunset.",
            "Write a poem about finding strength in difficult times."
        ];
        
        this.init();
    }

    init() {
        if (!this.generateBtn) return;

        this.generateBtn.addEventListener('click', () => this.handleGenerate());
        
        if (this.trySampleBtn) {
            this.trySampleBtn.addEventListener('click', () => this.insertSample());
        }
        
        if (this.regenerateBtn) {
            this.regenerateBtn.addEventListener('click', () => this.handleGenerate());
        }
        
        if (this.copyBtn) {
            this.copyBtn.addEventListener('click', () => this.copyPoem());
        }
        
        if (this.downloadBtn) {
            this.downloadBtn.addEventListener('click', () => this.downloadPoem());
        }
        
        if (this.shareBtn) {
            this.shareBtn.addEventListener('click', () => this.sharePoem());
        }

        // Enter key to generate
        if (this.poemInput) {
            this.poemInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    this.handleGenerate();
                }
            });
        }
    }

    insertSample() {
        if (!this.poemInput) return;
        const randomIndex = Math.floor(Math.random() * this.sampleIdeas.length);
        this.poemInput.value = this.sampleIdeas[randomIndex];
        this.poemInput.focus();
    }

    async handleGenerate() {
        const idea = this.poemInput?.value?.trim();
        
        if (!idea || idea.length < 3) {
            this.showNotification('Please enter a poem idea (at least 3 characters)', 'error');
            return;
        }

        const style = this.styleSelect?.value || 'auto';
        const mood = this.moodSelect?.value || 'auto';

        this.lastRequest = { idea, style, mood };
        this.showLoading();

        try {
            const response = await fetch(API_ENDPOINTS.POEM.GENERATE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idea: idea,
                    style: style,
                    mood: mood,
                    language: this.lang
                })
            });

            const result = await response.json();

            if (!result.success) {
                if (result.error === 'RATE_LIMIT_EXCEEDED') {
                    this.showNotification('Daily limit exceeded. Please try again tomorrow.', 'error');
                    this.showDefault();
                    return;
                }
                throw new Error(result.message || 'Generation failed');
            }

            this.displayResult(result.data);

        } catch (error) {
            console.error('Generation error:', error);
            this.showNotification(error.message || 'Failed to generate poem. Please try again.', 'error');
            this.showDefault();
        }
    }

    showLoading() {
        if (this.previewDefault) this.previewDefault.style.display = 'none';
        if (this.previewResult) this.previewResult.style.display = 'none';
        if (this.previewLoading) this.previewLoading.style.display = 'flex';
        
        this.animateLoadingSteps();
    }

    animateLoadingSteps() {
        const steps = [
            document.getElementById('loadStep1'),
            document.getElementById('loadStep2'),
            document.getElementById('loadStep3')
        ];

        steps.forEach((step, index) => {
            if (step) {
                step.classList.remove('active', 'step-complete');
                step.querySelector('i').className = 'fas fa-circle';
            }
        });

        let currentStep = 0;
        const interval = setInterval(() => {
            if (currentStep < steps.length && steps[currentStep]) {
                if (currentStep > 0 && steps[currentStep - 1]) {
                    steps[currentStep - 1].classList.remove('active');
                    steps[currentStep - 1].classList.add('step-complete');
                    steps[currentStep - 1].querySelector('i').className = 'fas fa-check-circle';
                }
                steps[currentStep].classList.add('active');
                steps[currentStep].querySelector('i').className = 'fas fa-circle-notch fa-spin';
                currentStep++;
            } else {
                clearInterval(interval);
            }
        }, 2000);

        this.loadingInterval = interval;
    }

    showDefault() {
        if (this.loadingInterval) clearInterval(this.loadingInterval);
        if (this.previewLoading) this.previewLoading.style.display = 'none';
        if (this.previewResult) this.previewResult.style.display = 'none';
        if (this.previewDefault) this.previewDefault.style.display = 'flex';
    }

    displayResult(data) {
        if (this.loadingInterval) clearInterval(this.loadingInterval);
        
        if (this.previewLoading) this.previewLoading.style.display = 'none';
        if (this.previewDefault) this.previewDefault.style.display = 'none';
        if (this.previewResult) this.previewResult.style.display = 'flex';

        // Set title
        if (this.resultTitle) {
            this.resultTitle.textContent = data.title || 'Your Generated Poem';
        }

        // Display poem
        if (this.generatedPoem && data.sections) {
            let html = '';
            for (const section of data.sections) {
                html += `<p class="section-label">${this.escapeHtml(section.label)}</p>`;
                for (const line of section.lines) {
                    html += `<p class="lyrics-line">${this.escapeHtml(line)}</p>`;
                }
            }
            this.generatedPoem.innerHTML = html;
        } else if (this.generatedPoem && data.poem) {
            // Fallback to plain poem text
            const lines = data.poem.split('\n');
            let html = '';
            for (const line of lines) {
                if (line.startsWith('[') && line.endsWith(']')) {
                    html += `<p class="section-label">${this.escapeHtml(line.slice(1, -1))}</p>`;
                } else if (line.trim()) {
                    html += `<p class="lyrics-line">${this.escapeHtml(line)}</p>`;
                }
            }
            this.generatedPoem.innerHTML = html;
        }

        // Store for copy/download
        this.currentPoem = data;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    copyPoem() {
        if (!this.currentPoem) return;
        
        let text = `${this.currentPoem.title || 'Generated Poem'}\n\n`;
        
        if (this.currentPoem.sections) {
            for (const section of this.currentPoem.sections) {
                text += `[${section.label}]\n`;
                text += section.lines.join('\n') + '\n\n';
            }
        } else if (this.currentPoem.poem) {
            text += this.currentPoem.poem;
        }

        navigator.clipboard.writeText(text.trim()).then(() => {
            this.showNotification('Poem copied to clipboard!', 'success');
        }).catch(() => {
            this.showNotification('Failed to copy poem', 'error');
        });
    }

    downloadPoem() {
        if (!this.currentPoem) return;
        
        let text = `${this.currentPoem.title || 'Generated Poem'}\n`;
        text += `Style: ${this.currentPoem.style || 'N/A'}\n`;
        text += `Mood: ${this.currentPoem.mood || 'N/A'}\n\n`;
        
        if (this.currentPoem.sections) {
            for (const section of this.currentPoem.sections) {
                text += `[${section.label}]\n`;
                text += section.lines.join('\n') + '\n\n';
            }
        } else if (this.currentPoem.poem) {
            text += this.currentPoem.poem;
        }

        const blob = new Blob([text.trim()], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(this.currentPoem.title || 'poem').replace(/[^a-z0-9]/gi, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Poem downloaded!', 'success');
    }

    sharePoem() {
        if (navigator.share) {
            navigator.share({
                title: this.currentPoem?.title || 'AI Generated Poem',
                text: 'Check out this AI generated poem!',
                url: window.location.href
            }).catch(() => {});
        } else {
            this.copyPoem();
        }
    }

    showNotification(message, type = 'info') {
        const alertClass = type === 'error' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info';
        const notification = document.createElement('div');
        notification.className = `alert ${alertClass}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            min-width: 280px; padding: 12px 20px; border-radius: 8px;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize poem generator
    new PoemGenerator();

    // Smooth scrolling for anchor links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href === '#' || href === '') return;

            e.preventDefault();
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                const navbar = document.querySelector('.navbar');
                const navbarHeight = navbar ? navbar.offsetHeight : 0;
                const targetPosition = targetElement.offsetTop - navbarHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
});
