// API Keys Page Specific JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the api-keys page
    if (window.location.pathname.includes('api-keys')) {
        initializeApiKeysPage();
    }
});

let apiKeysAPI;
let currentApiKeysPage = 1;
let apiKeysPerPage = 10;

async function initializeApiKeysPage() {
    try {
        apiKeysAPI = new ApiKeysAPI();
        
        // Load initial data
        await Promise.all([
            loadApiKeysSummary(),
            loadApiKeys(1)
        ]);
        
        // Setup event listeners
        setupApiKeysEventListeners();
        
    } catch (error) {
        console.error('Failed to initialize API keys page:', error);
        showError('apikeys-content', getTranslation('api_keys.failed_to_load', 'Failed to load API keys data. Please try again.'));
    }
}

async function loadApiKeysSummary() {
    try {
        const response = await apiKeysAPI.getApiKeysSummary();
        if (response.success) {
            displayApiKeysSummary(response.data);
        }
    } catch (error) {
        console.error('Failed to load API keys summary:', error);
    }
}

async function loadApiKeys(page = 1) {
    try {
        const offset = (page - 1) * apiKeysPerPage;
        
        // Show loading state
        showLoading('apikeys-list');
        
        const response = await apiKeysAPI.getUserApiKeys(apiKeysPerPage, offset);
        
        if (response.success) {
            displayApiKeys(response.data.api_keys, response.data.pagination);
            currentApiKeysPage = page;
        } else {
            throw new Error(response.error || getTranslation('api_keys.failed_to_load', 'Failed to load API keys'));
        }
    } catch (error) {
        console.error('Failed to load API keys:', error);
        showError('apikeys-list', `${getTranslation('api_keys.failed_to_load', 'Failed to load API keys')}: ${error.message}`);
    }
}

function displayApiKeysSummary(summary) {
    const summaryContainer = document.getElementById('apikeys-summary');
    if (!summaryContainer) return;
    
    summaryContainer.innerHTML = `
        <div class="row">
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${summary.total_keys || 0}</h5>
                        <p class="card-text text-muted">Total API Keys</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title text-success">${summary.active_keys || 0}</h5>
                        <p class="card-text text-muted">Active Keys</p>
                    </div>
                </div>
            </div>
            <div class="col-md-4 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title text-warning">${summary.inactive_keys || 0}</h5>
                        <p class="card-text text-muted">Inactive Keys</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function displayApiKeys(apiKeys, pagination) {
    const apiKeysContainer = document.getElementById('apikeys-list');
    if (!apiKeysContainer) return;
    
    if (!apiKeys || apiKeys.length === 0) {
        apiKeysContainer.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-key fa-3x text-muted mb-3"></i>
                <h5>No API keys found</h5>
                <p class="text-muted">You haven't created any API keys yet.</p>
                <button class="btn btn-primary" onclick="showCreateApiKeyModal()">
                    <i class="fas fa-plus me-2"></i>Create Your First API Key
                </button>
            </div>
        `;
        return;
    }
    
    let apiKeysHtml = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>API Key</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    apiKeys.forEach(apiKey => {
        const statusClass = apiKey.status === 'active' ? 'bg-success' : 'bg-warning';
        apiKeysHtml += `
            <tr>
                <td>
                    <strong>${apiKey.title || 'Untitled'}</strong>
                </td>
                <td>
                    <code class="api-key-display">${apiKey.api_key}</code>
                    <button class="btn btn-sm btn-outline-secondary ms-2" onclick="copyToClipboard('${apiKey.api_key}', this)" title="Copy to clipboard">
                        <i class="fas fa-copy"></i>
                    </button>
                </td>
                <td>
                    <span class="badge ${statusClass}">${apiKey.status || 'active'}</span>
                </td>
                <td>${formatDate(apiKey.created_at)}</td>
                <td>
                    <div class="btn-group" role="group">
                        <button class="btn btn-sm btn-outline-warning" onclick="toggleApiKeyStatus(${apiKey.id}, '${apiKey.status === 'active' ? 'inactive' : 'active'}')" title="${apiKey.status === 'active' ? 'Deactivate' : 'Activate'}">
                            <i class="fas fa-${apiKey.status === 'active' ? 'pause' : 'play'}"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteApiKey(${apiKey.id}, '${apiKey.title}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    apiKeysHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    // Add pagination
    const paginationHtml = createPagination(pagination, 'goToApiKeysPage');
    if (paginationHtml) {
        apiKeysHtml += `<div class="mt-4">${paginationHtml}</div>`;
    }
    
    apiKeysContainer.innerHTML = apiKeysHtml;
}

function setupApiKeysEventListeners() {
    // Create API key button
    const createBtn = document.getElementById('create-apikey-btn');
    if (createBtn) {
        createBtn.addEventListener('click', showCreateApiKeyModal);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-apikeys');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadApiKeys(currentApiKeysPage);
        });
    }
    
    // Create API key form
    const createForm = document.getElementById('create-apikey-form');
    if (createForm) {
        createForm.addEventListener('submit', handleCreateApiKey);
    }
}

function showCreateApiKeyModal() {
    const modal = new bootstrap.Modal(document.getElementById('createApiKeyModal'));
    modal.show();
}

async function handleCreateApiKey(event) {
    event.preventDefault();
    
    const form = event.target;
    const title = form.title.value.trim();
    
    if (!title) {
        showErrorNotification('Please enter a title for the API key');
        return;
    }
    
    try {
        // Disable form
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Creating...';
        
        const response = await apiKeysAPI.createApiKey(title);
        
        if (response.success) {
            // Show the full API key in a modal
            showApiKeyCreatedModal(response.data.api_key);
            
            // Reset form
            form.reset();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createApiKeyModal'));
            modal.hide();
            
            // Refresh list
            await loadApiKeys(1);
            await loadApiKeysSummary();
            
        } else {
            throw new Error(response.error || 'Failed to create API key');
        }
    } catch (error) {
        console.error('Create API key error:', error);
        showErrorNotification(`Failed to create API key: ${error.message}`);
    } finally {
        // Re-enable form
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function showApiKeyCreatedModal(apiKeyData) {
    // Create a modal to show the full API key
    const modalHtml = `
        <div class="modal fade" id="apiKeyCreatedModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title">API Key Created Successfully</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            <strong>Important:</strong> This is the only time you will see the full API key. Please copy it and store it securely.
                        </div>
                        <div class="form-group">
                            <label>Your API Key:</label>
                            <div class="input-group">
                                <input type="text" class="form-control font-monospace" id="newApiKeyValue" value="${apiKeyData.api_key}" readonly>
                                <button class="btn btn-outline-primary" onclick="copyToClipboard('${apiKeyData.api_key}', this)" type="button">
                                    <i class="fas fa-copy me-2"></i>Copy
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">I've saved it</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('apiKeyCreatedModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('apiKeyCreatedModal'));
    modal.show();
    
    // Auto-select the API key for easy copying
    document.getElementById('newApiKeyValue').select();
}

async function toggleApiKeyStatus(apiKeyId, newStatus) {
    try {
        const response = await apiKeysAPI.updateApiKeyStatus(apiKeyId, newStatus);
        
        if (response.success) {
            showSuccessNotification(`API key ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
            
            // Refresh list and summary
            await loadApiKeys(currentApiKeysPage);
            await loadApiKeysSummary();
        } else {
            throw new Error(response.error || 'Failed to update API key status');
        }
    } catch (error) {
        console.error('Toggle API key status error:', error);
        showErrorNotification(`Failed to update API key: ${error.message}`);
    }
}

function confirmDeleteApiKey(apiKeyId, title) {
    if (confirm(`Are you sure you want to delete the API key "${title}"? This action cannot be undone.`)) {
        deleteApiKey(apiKeyId);
    }
}

async function deleteApiKey(apiKeyId) {
    try {
        const response = await apiKeysAPI.deleteApiKey(apiKeyId);
        
        if (response.success) {
            showSuccessNotification('API key deleted successfully');
            
            // Refresh list and summary
            await loadApiKeys(currentApiKeysPage);
            await loadApiKeysSummary();
        } else {
            throw new Error(response.error || 'Failed to delete API key');
        }
    } catch (error) {
        console.error('Delete API key error:', error);
        showErrorNotification(`Failed to delete API key: ${error.message}`);
    }
}

function copyToClipboard(text, buttonElement) {
    navigator.clipboard.writeText(text).then(function() {
        // Update button to show success
        const originalHtml = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fas fa-check text-success"></i>';
        
        setTimeout(() => {
            buttonElement.innerHTML = originalHtml;
        }, 2000);
        
        showSuccessNotification('API key copied to clipboard');
    }).catch(function(err) {
        console.error('Could not copy text: ', err);
        
        // Fallback: select the text
        const tempInput = document.createElement('input');
        tempInput.value = text;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        
        showSuccessNotification('API key copied to clipboard');
    });
}

// Pagination handler
function goToApiKeysPage(page) {
    loadApiKeys(page);
}

// Make functions globally available
window.goToApiKeysPage = goToApiKeysPage;
window.showCreateApiKeyModal = showCreateApiKeyModal;
window.toggleApiKeyStatus = toggleApiKeyStatus;
window.confirmDeleteApiKey = confirmDeleteApiKey;
window.copyToClipboard = copyToClipboard;