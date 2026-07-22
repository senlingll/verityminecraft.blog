// Simplified Homepage Image Generator
class HomepageImageGenerator {
    constructor() {
        this.API_BASE_URL = window.API_BASE_URL;
        this.uploadedImageUrl = null;
        this.generatedImageUrl = null;
        this.isGenerating = false;
        // Get current language from server-side data first, then fallback to HTML attribute
        const lang = (window.i18nData && window.i18nData.currentLang) || document.documentElement.lang || 'en';
        this.language = lang;
        this.currentStyleId = 'room_design'; // Fixed room design ID
        
        // Selection state
        this.selectedStyle = null;
        this.selectedFunction = null;
        
        this.init();
    }

    init() {
        this.setupUploadHandlers();
        this.setupExampleHandlers();
        this.setupSelectionHandlers();
    }

    // Convert a worker-relative path (/api/...) to an absolute URL based on API_BASE_URL
    toAbsoluteApiUrl(urlOrPath) {
        if (!urlOrPath) return urlOrPath;
        if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
        const origin = this.API_BASE_URL.replace(/\/?api\/?$/, '');
        return `${origin}${urlOrPath}`;
    }

    setupUploadHandlers() {
        const uploadArea = document.getElementById('uploadArea');
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput');

        if (!uploadArea || !uploadBtn || !fileInput) {
            console.log('Upload elements not found, waiting for DOM ready...');
            return;
        }

        // Remove existing event listeners first to prevent duplicates
        uploadArea.replaceWith(uploadArea.cloneNode(true));
        const newUploadArea = document.getElementById('uploadArea');
        const newUploadBtn = document.getElementById('uploadBtn');
        const newFileInput = document.getElementById('fileInput');

        // Upload area click handler
        newUploadArea.addEventListener('click', (e) => {
            // Prevent triggering when modal is open, user is generating, or in fullscreen mode
            if (this.isGenerating || this.isModalOpen() || this.isFullscreenMode()) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            newFileInput.click();
        });

        // Upload button click handler
        newUploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.isGenerating || this.isModalOpen() || this.isFullscreenMode()) {
                e.preventDefault();
                return;
            }
            newFileInput.click();
        });

        // File input change handler
        newFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0 && !this.isGenerating && !this.isFullscreenMode()) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Drag and drop handlers
        newUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (!this.isGenerating && !this.isModalOpen() && !this.isFullscreenMode()) {
                newUploadArea.classList.add('dragover');
            }
        });

        newUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            newUploadArea.classList.remove('dragover');
        });

        newUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            newUploadArea.classList.remove('dragover');

            if (!this.isGenerating && !this.isModalOpen() && !this.isFullscreenMode() && e.dataTransfer.files.length > 0) {
                this.handleFileUpload(e.dataTransfer.files[0]);
            }
        });
    }

    setupExampleHandlers() {
        // Remove style selector functionality - now handled by style selection UI
        // Only keep example handlers for demonstration purposes
        const exampleItems = document.querySelectorAll('.example-item');
        exampleItems.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', () => {
                // Example click handler - functionality removed as data-example attributes not found in templates
            });
        });
    }

    setupSelectionHandlers() {
        // Setup style selection handlers
        const styleOptions = document.querySelectorAll('.style-option');
        styleOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove previous selection
                styleOptions.forEach(opt => opt.classList.remove('selected'));
                
                // Add selection to clicked option
                option.classList.add('selected');
                
                // Store selected style
                this.selectedStyle = option.dataset.style;
                
                // Update after image based on selected style
                this.updateAfterImage(this.selectedStyle);
                
                console.log('Selected style:', this.selectedStyle);
            });
        });

        // Setup function selection handlers
        const functionSelect = document.getElementById('functionSelect');
        if (functionSelect) {
            functionSelect.addEventListener('change', (e) => {
                this.selectedFunction = e.target.value;
                console.log('Selected function:', this.selectedFunction);
            });

            // Initialize from default selected value if present
            if (functionSelect.value) {
                this.selectedFunction = functionSelect.value;
                console.log('Initialized function from default:', this.selectedFunction);
            }
        }

        // Initialize from default selected style option if present
        const defaultSelectedStyle = document.querySelector('.style-option.selected');
        if (defaultSelectedStyle && defaultSelectedStyle.dataset.style) {
            this.selectedStyle = defaultSelectedStyle.dataset.style;
            this.updateAfterImage(this.selectedStyle);
            console.log('Initialized style from default:', this.selectedStyle);
        }
    }

    updateAfterImage(styleName) {
        const afterImageSrc = document.getElementById('afterImageSrc');
        if (afterImageSrc && styleName) {
            // Capitalize first letter to match filename format
            const capitalizedStyle = styleName.charAt(0).toUpperCase() + styleName.slice(1);
            const imagePath = `/static/images/index/hero_sample/${capitalizedStyle}.webp`;
            afterImageSrc.src = imagePath;
            
            console.log('Updated after image to:', imagePath);
        }
    }

    async handleFileUpload(file) {
        console.log('File uploaded:', file.name);
        console.log('Selected style:', this.selectedStyle);
        console.log('Selected function:', this.selectedFunction);
        
        // Validate selections
        if (!this.selectedStyle) {
            this.showError(this.getLocalizedText('branding.validation_errors.select_style_first', 'Please select a style first'));
            return;
        }
        
        if (!this.selectedFunction) {
            this.showError(this.getLocalizedText('branding.validation_errors.select_function_first', 'Please select a function first'));
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError(this.getLocalizedText('errors.invalid_file_type', 'Please select a valid image file.'));
            return;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError(this.getLocalizedText('errors.file_too_large', 'File too large, please select an image under 10MB.'));
            return;
        }

        // Check authentication first
        const token = localStorage.getItem('auth_token');
        if (!token) {
            this.showLoginPrompt();
            return;
        }

        try {
            // Directly call backend endpoint to generate and save to R2
            await this.generateFromLocalFile(file, token);
        } catch (error) {
            console.error('Error handling file upload:', error);
            this.showError(this.getLocalizedText('errors.upload_failed', 'Error processing uploaded image.'));
        }
    }

    // Style selection methods handled by setupSelectionHandlers



    async generateRoomDesign() {
        if (this.isGenerating || !this.uploadedImageUrl) return;
        
        const token = localStorage.getItem('auth_token');
        if (!token) {
            this.showLoginPrompt();
            return;
        }
        
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        try {
            this.isGenerating = true;
            this.showGeneratingState(uploadArea);

            const response = await this.callRoomDesignAPI(
                this.uploadedImageUrl,
                token
            );
            
            if (response.success) {
                this.generatedImageUrl = (response.data && response.data.output_url) || response.output || response.images?.[0];
                this.showGeneratedResult(uploadArea, this.generatedImageUrl);
            } else {
                throw new Error(response.error || 'Room design failed');
            }
            
        } catch (error) {
            console.error('Room design error:', error);
            if (error.message.includes('401') || error.message.includes('authentication') || error.error_type === 'authentication_failed') {
                localStorage.removeItem('auth_token');
                this.showLoginPrompt();
            } else if (error.error_type === 'insufficient_credits' || error.error_code === 'insufficient_credits' || error.status === 402) {
                this.showInsufficientCreditsError(uploadArea);
            } else {
                this.showError(error.message || this.getLocalizedText('errors.generation_failed', 'Room design failed, please try again.'));
                this.resetUploadArea(uploadArea);
            }
        } finally {
            this.isGenerating = false;
        }
    }

    async callRoomDesignAPI(inputImageUrl, token) {
        const response = await fetch(`${this.API_BASE_URL}/openrouter/style-transfer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                input_image_url: inputImageUrl,
                style: this.selectedStyle,
                room_function: this.selectedFunction
            })
        });

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            // Handle specific error types
            if (response.status === 402) {
                errorData.error_type = 'insufficient_credits';
                errorData.error_code = 'insufficient_credits';
            } else if (response.status === 401) {
                errorData.error_type = 'authentication_failed';
            }
            
            // Create an error object with additional properties
            const error = new Error(errorData.error || `HTTP ${response.status}`);
            error.error_type = errorData.error_type;
            error.error_code = errorData.error_code;
            error.status = response.status;
            throw error;
        }

        return await response.json();
    }

    async generateFromLocalFile(file, token) {
        const uploadArea = document.getElementById('uploadArea');
        if (!uploadArea) return;

        try {
            this.isGenerating = true;
            this.showGeneratingState(uploadArea);

            const formData = new FormData();
            formData.append('image', file);
            
            // Add style and function selections to the request
            if (this.selectedStyle) {
                formData.append('style', this.selectedStyle);
            }
            if (this.selectedFunction) {
                formData.append('room_function', this.selectedFunction);
            }

            const response = await fetch(`${this.API_BASE_URL}/openrouter/style-transfer-upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    throw new Error(`HTTP ${response.status}`);
                }

                if (response.status === 402) {
                    errorData.error_type = 'insufficient_credits';
                } else if (response.status === 401) {
                    errorData.error_type = 'authentication_failed';
                }

                const error = new Error(errorData.error || `HTTP ${response.status}`);
                error.error_type = errorData.error_type;
                throw error;
            }

            const result = await response.json();

            if (result.success) {
                this.uploadedImageUrl = result.data.input_image_url; // URL of original image 
                this.generatedImageUrl = result.data.output_url; // Generated image URL
                this.showGeneratedResult(uploadArea, this.generatedImageUrl);
            } else {
                throw new Error(result.error || 'Image generation failed');
            }

        } catch (error) {
            console.error('Image generation from local file error:', error);
            if (error.error_type === 'authentication_failed') {
                localStorage.removeItem('auth_token');
                this.showLoginPrompt();
            } else if (error.error_type === 'insufficient_credits') {
                this.showInsufficientCreditsError(uploadArea);
            } else {
                this.showError(error.message || this.getLocalizedText('errors.generation_failed', 'Image generation failed, please try again.'));
                this.resetUploadArea(uploadArea);
            }
        } finally {
            this.isGenerating = false;
        }
    }

    // Internationalization helper method using centralized translations
    getLocalizedText(key, defaultText) {
        // Use global translation function if available
        if (typeof window.getTranslation === 'function') {
            const result = window.getTranslation(key, defaultText);
            if (result !== defaultText) {
                return result;
            }
        }
        
        // Try to use server-injected i18nData first
        if (window.i18nData && window.i18nData.common) {
            const keys = key.split('.');
            let value = window.i18nData.common;
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    value = null;
                    break;
                }
            }
            
            if (typeof value === 'string' && value.trim() !== '') {
                return value;
            }
        }
        
        // Try to use FRONTEND_TRANSLATIONS directly
        if (window.FRONTEND_TRANSLATIONS && window.FRONTEND_TRANSLATIONS[this.language]) {
            const keys = key.split('.');
            let value = window.FRONTEND_TRANSLATIONS[this.language];
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    value = null;
                    break;
                }
            }
            
            if (typeof value === 'string' && value.trim() !== '') {
                return value;
            }
        }
        
        // Last fallback: try English translations if current language is not English
        if (this.language !== 'en' && window.FRONTEND_TRANSLATIONS && window.FRONTEND_TRANSLATIONS['en']) {
            const keys = key.split('.');
            let value = window.FRONTEND_TRANSLATIONS['en'];
            
            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    value = null;
                    break;
                }
            }
            
            if (typeof value === 'string' && value.trim() !== '') {
                return value;
            }
        }
        
        return defaultText;
    }

    // Check if any modal is currently open
    isModalOpen() {
        const modals = document.querySelectorAll('.modal.show, .modal[style*="display: block"]');
        return modals.length > 0 || document.body.classList.contains('modal-open');
    }

    // Check if currently in fullscreen mode
    isFullscreenMode() {
        const uploadArea = document.getElementById('uploadArea');
        return uploadArea && uploadArea.style.position === 'fixed';
    }

    showGeneratingState(uploadArea) {
        const generatingText = this.getLocalizedText('branding.generator.generating', 'Designing room with AI');
        const consumeText = this.getLocalizedText('branding.generator.consume_credits', 'This will consume 2 credits, please wait...');
        const processingTimeText = this.getLocalizedText('branding.generator.processing_time', 'Processing may take 10 seconds to 1 minute');
        
        // Show selected options in generating state
        const styleLabelText = this.getLocalizedText('branding.generator.style_label', 'Style:');
        const functionLabelText = this.getLocalizedText('branding.generator.function_label', 'Function:');
        const styleText = this.selectedStyle ? `${styleLabelText} ${this.getStyleDisplayName(this.selectedStyle)}` : '';
        const functionText = this.selectedFunction ? `${functionLabelText} ${this.getFunctionDisplayName(this.selectedFunction)}` : '';
        
        uploadArea.innerHTML = `
            <div class="upload-content">
                <div class="upload-icon" style="background: #4caf50;">
                    <div class="spinner-border spinner-border-sm text-white" role="status">
                        <span class="visually-hidden">${generatingText}...</span>
                    </div>
                </div>
                <h4 class="upload-title">${generatingText}</h4>
                ${styleText ? `<p class="upload-text text-success mb-1"><i class="fas fa-palette me-1"></i>${styleText}</p>` : ''}
                ${functionText ? `<p class="upload-text text-success mb-1"><i class="fas fa-home me-1"></i>${functionText}</p>` : ''}
                <p class="upload-text text-muted mb-1">${consumeText}</p>
                <p class="upload-text text-info"><i class="fas fa-clock me-1"></i>${processingTimeText}</p>
                <div class="progress mt-2" style="height: 4px; max-width: 200px;">
                    <div class="progress-bar progress-bar-striped progress-bar-animated bg-success" role="progressbar" style="width: 100%"></div>
                </div>
            </div>
        `;
        
        // Keep the same upload area styling
        uploadArea.style.minHeight = '';
        uploadArea.style.padding = '';
        uploadArea.style.border = '2px dashed #4caf50';
        uploadArea.style.borderRadius = '12px';
        uploadArea.style.background = 'linear-gradient(135deg, #e8f5e9 0, #f0fff4 100%)';
    }

    getStyleDisplayName(style) {
        return this.getLocalizedText(`branding.style_names.${style}`, style);
    }

    getFunctionDisplayName(func) {
        return this.getLocalizedText(`branding.function_names.${func}`, func);
    }

    showGeneratedResult(uploadArea, imageUrl) {
        const successText = this.getLocalizedText('branding.generator.success', 'Room design generated successfully!');
        const consumedText = this.getLocalizedText('branding.generator.consumed_credits', '2 credits consumed');
        const downloadText = this.getLocalizedText('common.download', 'Download Image');
        const regenerateText = this.getLocalizedText('branding.generator.regenerate', 'Design Another');
        const closeText = this.getLocalizedText('common.close', 'Close');
        const originalText = this.getLocalizedText('branding.generator.original', 'Original');
        const generatedText = this.getLocalizedText('branding.generator.generated', 'AI Designed');
        const uploadNewText = this.getLocalizedText('branding.generator.upload_new', 'Upload New Room');

        // Ensure absolute URL for API-served images
        const finalImageUrl = this.toAbsoluteApiUrl(imageUrl);

        // 不再隐藏原始对比区域，保留 branding-section

        // Create or get result section before Feature Section
        let resultSection = document.getElementById('generatedResultSection');
        if (!resultSection) {
            resultSection = document.createElement('section');
            resultSection.id = 'generatedResultSection';
            resultSection.className = 'generated-result-section py-5';

            // Find Feature Section and insert before it
            const featureSection = document.querySelector('.feature-section, .feature, section[class*="feature"]');
            const brandingSection = document.querySelector('.branding-section');

            if (featureSection && brandingSection) {
                // Insert after branding section but before feature section
                brandingSection.parentNode.insertBefore(resultSection, featureSection);
            } else if (brandingSection) {
                // Fallback: insert after branding section
                brandingSection.parentNode.insertBefore(resultSection, brandingSection.nextSibling);
            } else {
                // Last fallback: append to body
                document.body.appendChild(resultSection);
            }
        }

        // Update upload area to show success message but keep upload functionality
        uploadArea.innerHTML = `
            <div class="upload-content">
                <div class="upload-icon" style="background: #28a745;">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h4 class="upload-title text-success">${successText}</h4>
                <p class="upload-text text-muted mb-2">${consumedText}</p>
                <button class="btn btn-outline-primary btn-sm" onclick="window.homepageGenerator.resetForNewUpload()">
                    <i class="fas fa-upload me-1"></i>${uploadNewText}
                </button>
                <input type="file" id="fileInput" accept="image/*" class="d-none">
            </div>
        `;

        // Apply success styling but keep consistent size
        uploadArea.style.maxWidth = '';
        uploadArea.style.cursor = 'default';
        uploadArea.style.border = '2px solid #28a745';
        uploadArea.style.borderRadius = '12px';
        uploadArea.style.background = 'linear-gradient(135deg, #d4edda 0, #f0fff4 100%)';
        uploadArea.style.minHeight = '';
        uploadArea.style.padding = '';

        // Show result in dedicated section
        resultSection.innerHTML = `
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-lg-10">
                        <div class="result-container">
                            <!-- Image Comparison -->
                            <div class="row g-4 mb-4">
                                <div class="col-md-6">
                                    <div class="text-center mb-3">
                                        <span class="badge bg-primary fs-6 px-3 py-2">${originalText}</span>
                                    </div>
                                    <div class="result-image-wrapper">
                                        <img src="${this.uploadedImageUrl}" alt="Original image" class="result-image">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="text-center mb-3">
                                        <span class="badge bg-success fs-6 px-3 py-2">${generatedText}</span>
                                    </div>
                                    <div class="result-image-wrapper">
                                        <img src="${finalImageUrl}" alt="Restored photo" class="result-image">
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="text-center">
                                <div class="d-flex flex-wrap justify-content-center gap-3">
                                    <button class="btn btn-success btn-lg" onclick="window.homepageGenerator.downloadGeneratedImage()">
                                        <i class="fas fa-download me-2"></i>${downloadText}
                                    </button>
                                    <button class="btn btn-outline-secondary btn-lg" onclick="window.homepageGenerator.resetForNewGeneration()">
                                        <i class="fas fa-redo me-2"></i>${regenerateText}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Scroll to result section
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Re-setup upload handlers for the new file input
        setTimeout(() => {
            this.setupUploadHandlers();
        }, 100);
    }

    showLoginPrompt() {
        const loginText = this.getLocalizedText('branding.generator.login_required', 'Please Sign In');
        const loginDescText = this.getLocalizedText('branding.generator.login_required_desc', 'You need to sign in to use the room design feature');
        const loginButtonText = this.getLocalizedText('auth.sign_in', 'Sign In Now');
        
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-content">
                    <div class="upload-icon" style="background: #6c757d;">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <h4 class="upload-title">${loginText}</h4>
                    <p class="upload-text text-muted mb-2">${loginDescText}</p>
                    <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#signInModal">
                        <i class="fas fa-sign-in-alt me-1"></i>${loginButtonText}
                    </button>
                </div>
            `;
            
            // Keep the same upload area styling
            uploadArea.style.minHeight = '';
            uploadArea.style.padding = '';
            uploadArea.style.border = '2px dashed #6c757d';
            uploadArea.style.borderRadius = '12px';
            uploadArea.style.background = 'linear-gradient(135deg, #f8f9fa 0, #e9ecef 100%)';
        }
    }

    showInsufficientCreditsError(uploadArea) {
        // Get localized text from window.i18nData if available
        let insufficientText, insufficientDescText, getCreditsText, backText;
        
        if (window.i18nData && window.i18nData.errors) {
            // Use backend i18n data
            insufficientText = window.i18nData.errors.insufficient_credits || 'Insufficient Credits';
            insufficientDescText = window.i18nData.generator?.insufficient_credits_desc || 'You need at least 2 credits to generate images';
            getCreditsText = window.i18nData.generator?.get_credits || 'Get Credits';
            backText = window.i18nData.common?.back || 'Back';
        } else {
            // Fallback to frontend i18n
            insufficientText = this.getLocalizedText('errors.insufficient_credits', 'Insufficient Credits');
            insufficientDescText = this.getLocalizedText('branding.generator.insufficient_credits_desc', 'You need at least 2 credits to generate room designs');
            getCreditsText = this.getLocalizedText('branding.generator.get_credits', 'Get Credits');
            backText = this.getLocalizedText('common.back', 'Back');
        }
        
        uploadArea.innerHTML = `
            <div class="upload-content">
                <div class="upload-icon" style="background: #ffc107;">
                    <i class="fas fa-coins"></i>
                </div>
                <h4 class="upload-title text-warning">${insufficientText}</h4>
                <p class="upload-text text-muted mb-2">${insufficientDescText}</p>
                <div class="d-flex flex-wrap justify-content-center gap-2">
                    <a href="/my-credits" class="btn btn-warning btn-sm">
                        <i class="fas fa-plus me-1"></i>${getCreditsText}
                    </a>
                    <button class="btn btn-outline-secondary btn-sm" onclick="window.homepageGenerator.resetForNewGeneration()">
                        <i class="fas fa-arrow-left me-1"></i>${backText}
                    </button>
                </div>
            </div>
        `;
        
        // Keep the same upload area styling
        uploadArea.style.minHeight = '';
        uploadArea.style.padding = '';
        uploadArea.style.border = '2px dashed #ffc107';
        uploadArea.style.borderRadius = '12px';
        uploadArea.style.background = 'linear-gradient(135deg, #fff8e1 0, #fffbf0 100%)';
    }

    resetUploadArea(uploadArea) {
        // Remove result section if exists
        const resultSection = document.getElementById('generatedResultSection');
        if (resultSection) {
            resultSection.remove();
        }
        
        // Reset upload area to original HTML structure with proper i18n texts
        uploadArea.innerHTML = `
            <div class="upload-content">
                <div class="upload-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <button class="btn btn-upload" id="uploadBtn">
                    <i class="fas fa-upload me-2"></i>
                    ${this.getLocalizedText('branding.generator.upload_button', 'Upload Photo')}
                </button>
                <p class="upload-text">${this.getLocalizedText('branding.generator.upload_text', 'or drag and drop image here')}</p>
            </div>
            <input type="file" id="fileInput" accept="image/*" class="d-none">
        `;
        
        // Reset all styles to original
        uploadArea.style.position = '';
        uploadArea.style.top = '';
        uploadArea.style.left = '';
        uploadArea.style.width = '';
        uploadArea.style.height = '';
        uploadArea.style.maxWidth = '';
        uploadArea.style.zIndex = '';
        uploadArea.style.cursor = 'pointer';
        uploadArea.style.border = '3px dashed #d0d0d0';
        uploadArea.style.borderRadius = '20px';
        uploadArea.style.background = 'white';
        uploadArea.style.padding = '60px 40px';
        uploadArea.style.borderStyle = 'dashed';
        uploadArea.style.pointerEvents = '';
        
        // Re-setup event handlers after a short delay to prevent immediate triggering
        setTimeout(() => {
            this.setupUploadHandlers();
            this.setupSelectionHandlers();
        }, 500);
    }

    resetForNewGeneration() {
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            this.resetUploadArea(uploadArea);
        }
        this.uploadedImageUrl = null;
        this.generatedImageUrl = null;
        
        // Reset selections
        this.selectedStyle = null;
        this.selectedFunction = null;
        
        // Reset UI selections
        document.querySelectorAll('.style-option.selected').forEach(opt => opt.classList.remove('selected'));
        const functionSelect = document.getElementById('functionSelect');
        if (functionSelect) {
            functionSelect.value = '';
        }
    }

    resetForNewUpload() {
        const uploadArea = document.getElementById('uploadArea');
        if (uploadArea) {
            // Reset to original upload area HTML
            uploadArea.innerHTML = `
                <div class="upload-content">
                    <div class="upload-icon">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <button class="btn btn-upload" id="uploadBtn">
                        <i class="fas fa-upload me-2"></i>
                        ${this.getLocalizedText('branding.generator.upload_button', 'Upload Photo')}
                    </button>
                    <p class="upload-text">${this.getLocalizedText('branding.generator.upload_text', 'or drag and drop image here')}</p>
                </div>
                <input type="file" id="fileInput" accept="image/*" class="d-none">
            `;
            
            // Reset all styles to original
            uploadArea.style.position = '';
            uploadArea.style.top = '';
            uploadArea.style.left = '';
            uploadArea.style.width = '';
            uploadArea.style.height = '';
            uploadArea.style.maxWidth = '';
            uploadArea.style.zIndex = '';
            uploadArea.style.cursor = 'pointer';
            uploadArea.style.border = '3px dashed #d0d0d0';
            uploadArea.style.borderRadius = '20px';
            uploadArea.style.background = 'white';
            uploadArea.style.padding = '60px 40px';
            uploadArea.style.borderStyle = 'dashed';
            uploadArea.style.pointerEvents = '';
            
            // Re-setup event handlers
            setTimeout(() => {
                this.setupUploadHandlers();
                this.setupSelectionHandlers();
            }, 100);
        }
    }

    async downloadGeneratedImage() {
        if (!this.generatedImageUrl) return;
        
        try {
            const response = await fetch(this.toAbsoluteApiUrl(this.generatedImageUrl));
            const blob = await response.blob();

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `photo-restored-${Date.now()}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            this.showSuccess(this.getLocalizedText('messages.download_success', 'Image downloaded successfully!'));
        } catch (error) {
            console.error('Download error:', error);
            this.showError(this.getLocalizedText('messages.download_failed', 'Failed to download image.'));
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.generation-notification');
        existingNotifications.forEach(n => n.remove());

        // Create notification
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} generation-notification`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            min-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.innerHTML = `
            <div class="d-flex align-items-center">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'success' ? 'check-circle' : 'info-circle'} me-2"></i>
                <span>${message}</span>
                <button type="button" class="btn-close ms-auto" onclick="this.parentElement.parentElement.remove()"></button>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize on homepage only
    const pathname = window.location.pathname;
    const shouldInitialize = 
        pathname === '/' || 
        pathname.match(/^\/[a-z]{2}\/?$/);
    
    if (shouldInitialize) {
        // Wait a bit for the branding section to load
        setTimeout(() => {
            window.homepageGenerator = new HomepageImageGenerator();
        }, 500);
    }
});