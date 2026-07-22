// My Credits Page Specific JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the my-credits page
    if (window.location.pathname.includes('my-credits')) {
        initializeCreditsPage();
    }
});

let creditsAPI;
let currentCreditsPage = 1;
let creditsPerPage = 10;

async function initializeCreditsPage() {
    try {
        creditsAPI = new CreditsAPI();
        
        // Load initial data
        await Promise.all([
            loadCreditsSummary(),
            loadCredits(1)
        ]);
        
        // Setup event listeners
        setupCreditsEventListeners();
        
    } catch (error) {
        console.error('Failed to initialize credits page:', error);
        showError('credits-content', 'Failed to load credits data. Please try again.');
    }
}

async function loadCreditsSummary() {
    try {
        const [summaryResponse, balanceResponse] = await Promise.all([
            creditsAPI.getCreditsSummary(),
            creditsAPI.getCreditBalance()
        ]);
        
        if (summaryResponse.success && balanceResponse.success) {
            displayCreditsSummary(summaryResponse.data, balanceResponse.data);
        }
    } catch (error) {
        console.error('Failed to load credits summary:', error);
    }
}

async function loadCredits(page = 1) {
    try {
        const offset = (page - 1) * creditsPerPage;
        
        // Show loading state
        showLoading('credits-list');
        
        const response = await creditsAPI.getUserCredits(creditsPerPage, offset);
        
        if (response.success) {
            displayCredits(response.data.transactions, response.data.pagination);
            currentCreditsPage = page;
        } else {
            throw new Error(response.error || 'Failed to load credits');
        }
    } catch (error) {
        console.error('Failed to load credits:', error);
        showError('credits-list', `Failed to load credits: ${error.message}`);
    }
}

function displayCreditsSummary(summary, balance) {
    const summaryContainer = document.getElementById('credits-summary');
    if (!summaryContainer) return;
    
    summaryContainer.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card text-center bg-primary text-white">
                    <div class="card-body">
                        <h4 class="card-title">${formatCredits(balance.total_credits || 0)}</h4>
                        <p class="card-text">Current Balance</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title text-success">${formatCredits(summary.total_earned || 0)}</h5>
                        <p class="card-text text-muted">Total Earned</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title text-warning">${formatCredits(summary.total_used || 0)}</h5>
                        <p class="card-text text-muted">Total Used</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${summary.total_transactions || 0}</h5>
                        <p class="card-text text-muted">Total Transactions</p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="alert alert-info">
            <div class="d-flex align-items-center">
                <i class="fas fa-info-circle fa-2x me-3"></i>
                <div>
                    <h6 class="mb-1">How to earn more credits?</h6>
                    <small>Invite friends, make purchases, or participate in promotions to earn more credits!</small>
                </div>
            </div>
        </div>
    `;
}

function displayCredits(credits, pagination) {
    const creditsContainer = document.getElementById('credits-list');
    if (!creditsContainer) return;
    
    if (!credits || credits.length === 0) {
        creditsContainer.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-coins fa-3x text-muted mb-3"></i>
                <h5>No credit transactions found</h5>
                <p class="text-muted">You don't have any credit transactions yet.</p>
            </div>
        `;
        return;
    }
    
    let creditsHtml = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Transaction</th>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Order</th>
                        <th>Expires</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    credits.forEach(credit => {
        const isPositive = credit.credits > 0;
        const amountClass = isPositive ? 'text-success' : 'text-danger';
        const icon = isPositive ? 'fa-plus' : 'fa-minus';
        
        creditsHtml += `
            <tr>
                <td>
                    <code class="small">${credit.trans_no}</code>
                </td>
                <td>${formatDate(credit.created_at)}</td>
                <td>
                    <span class="badge ${getCreditTypeClass(credit.trans_type)}">${formatTransType(credit.trans_type)}</span>
                </td>
                <td>
                    <span class="${amountClass}">
                        <i class="fas ${icon} me-1"></i>${Math.abs(credit.credits)} credits
                    </span>
                </td>
                <td>
                    ${credit.order_no ? 
                        `<code class="small">${credit.order_no}</code>` : 
                        '<span class="text-muted">-</span>'
                    }
                </td>
                <td>
                    ${credit.expired_at ? 
                        formatDate(credit.expired_at) : 
                        '<span class="text-muted">Never</span>'
                    }
                </td>
            </tr>
        `;
    });
    
    creditsHtml += `
                </tbody>
            </table>
        </div>
    `;
    
    // Add pagination
    const paginationHtml = createPagination(pagination, 'goToCreditsPage');
    if (paginationHtml) {
        creditsHtml += `<div class="mt-4">${paginationHtml}</div>`;
    }
    
    creditsContainer.innerHTML = creditsHtml;
}

function getCreditTypeClass(transType) {
    switch (transType?.toLowerCase()) {
        case 'purchase':
        case 'welcome':
        case 'bonus':
        case 'referral':
            return 'bg-success';
        case 'usage':
        case 'generation':
            return 'bg-warning';
        case 'refund':
            return 'bg-info';
        case 'expired':
        case 'penalty':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

function formatTransType(transType) {
    if (!transType) return 'Unknown';
    
    const typeMap = {
        'purchase': 'Purchase',
        'welcome': 'Welcome Bonus',
        'bonus': 'Bonus',
        'referral': 'Referral Reward',
        'usage': 'Image Generation',
        'generation': 'Usage',
        'refund': 'Refund',
        'expired': 'Expired',
        'penalty': 'Penalty'
    };
    
    return typeMap[transType.toLowerCase()] || transType;
}

function setupCreditsEventListeners() {
    // Refresh button
    const refreshBtn = document.getElementById('refresh-credits');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadCredits(currentCreditsPage);
            loadCreditsSummary();
        });
    }
    
    // Buy credits button
    const buyCreditsBtn = document.getElementById('buy-credits-btn');
    if (buyCreditsBtn) {
        buyCreditsBtn.addEventListener('click', function() {
            // Always redirect to pricing page with language support
            const parts = window.location.pathname.split('/').filter(Boolean);
            // Infer language from URL: if path looks like /<lang>/..., take first segment as lang; otherwise default to 'en'
            const lang = parts.length > 1 ? parts[0] : 'en';
            const pricingUrl = lang === 'en' ? '/pricing' : `/${lang}/pricing`;
            window.location.href = pricingUrl;
        });
    }
}

// Pagination handler
function goToCreditsPage(page) {
    loadCredits(page);
}

// Make function globally available
window.goToCreditsPage = goToCreditsPage;