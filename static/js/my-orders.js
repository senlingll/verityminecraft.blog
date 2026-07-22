// My Orders Page Specific JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on the my-orders page
    if (window.location.pathname.includes('my-orders')) {
        // Wait for translation system to be ready before initializing
        waitForTranslationSystem().then(() => {
            // Check for payment success status first
            checkPaymentSuccessStatus();
            initializeOrdersPage();
        }).catch(error => {
            console.error('Translation system failed to initialize:', error);
            // Proceed anyway with fallback translations
            checkPaymentSuccessStatus();
            initializeOrdersPage();
        });
    }
});

// Wait for translation system to be ready
function waitForTranslationSystem(maxWaitTime = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        function checkTranslationSystem() {
            // Check if i18nManager is available and initialized
            if (window.i18nManager && window.getTranslation && window.getOrderDetailsLabel) {
                resolve();
                return;
            }
            
            // Check if we've exceeded max wait time
            if (Date.now() - startTime > maxWaitTime) {
                resolve(); // Don't reject, just proceed with fallbacks
                return;
            }
            
            // Check again in 100ms
            setTimeout(checkTranslationSystem, 100);
        }
        
        checkTranslationSystem();
    });
}

let ordersAPI;
let currentOrdersPage = 1;
let ordersPerPage = 10;
let currentStatusFilter = null;

async function initializeOrdersPage() {
    try {
        ordersAPI = new OrdersAPI();

        // Load initial data - don't fail completely if one fails
        try {
            await loadOrdersSummary();
        } catch (summaryError) {
            console.error('Summary load failed:', summaryError);
        }

        try {
            await loadOrders(1);
        } catch (ordersError) {
            console.error('Orders load failed:', ordersError);
            showError('orders-list', `Failed to load orders: ${ordersError.message}`);
        }

        // Setup event listeners
        setupOrdersEventListeners();

    } catch (error) {
        console.error('Failed to initialize orders page:', error);
        showError('orders-list', 'Failed to load orders data. Please try again.');
    }
}

async function loadOrdersSummary() {
    try {
        const response = await ordersAPI.getOrdersSummary();
        if (response.success) {
            displayOrdersSummary(response.data);
        }
    } catch (error) {
        console.error('Failed to load orders summary:', error);
        // Don't show error for summary as it's not critical
    }
}

async function loadOrders(page = 1, status = null) {
    try {
        const offset = (page - 1) * ordersPerPage;

        // Show loading state
        showLoading('orders-list');

        const response = await ordersAPI.getUserOrders(ordersPerPage, offset, status);

        if (response.success) {
            displayOrders(response.data.orders, response.data.pagination);
            currentOrdersPage = page;
            currentStatusFilter = status;
        } else {
            throw new Error(response.error || 'Failed to load orders');
        }
    } catch (error) {
        console.error('Failed to load orders:', error);
        showError('orders-list', `Failed to load orders: ${error.message}`);
    }
}

function displayOrdersSummary(summary) {
    const summaryContainer = document.getElementById('orders-summary');
    if (!summaryContainer) return;

    // Use i18n labels when available (frontend-backend separated)
    const getT = (key, fallback) => (window.getTranslation ? window.getTranslation(key, fallback) : fallback);
    const getLabel = (labelKey, fallback) => (
        window.getOrderDetailsLabel ? window.getOrderDetailsLabel(labelKey, fallback) : getT(`payments.order_details.${labelKey}`, fallback)
    );

    const totalOrdersLabel = getLabel('total_orders', 'Total Orders');
    const totalAmountLabel = getLabel('total_amount', 'Total Amount');
    const totalCreditsLabel = getLabel('total_credits', 'Total Credits');
    const completedOrdersLabel = getLabel('completed_orders', 'Completed Orders');

    summaryContainer.innerHTML = `
        <div class="row">
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${summary.total_orders || 0}</h5>
                        <p class="card-text text-muted">${totalOrdersLabel}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${formatCurrency(summary.total_amount || 0)}</h5>
                        <p class="card-text text-muted">${totalAmountLabel}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${formatCredits(summary.total_credits || 0)}</h5>
                        <p class="card-text text-muted">${totalCreditsLabel}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-3 mb-3">
                <div class="card text-center">
                    <div class="card-body">
                        <h5 class="card-title">${summary.completed_orders || 0}</h5>
                        <p class="card-text text-muted">${completedOrdersLabel}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function displayOrders(orders, pagination) {
    const ordersContainer = document.getElementById('orders-list');
    if (!ordersContainer) return;

    // I18n helpers (moved to the top)
    const getT = (key, fallback) => (window.getTranslation ? window.getTranslation(key, fallback) : fallback);
    const getLabel = (labelKey, fallback) => (
        window.getOrderDetailsLabel ? window.getOrderDetailsLabel(labelKey, fallback) : getT(`payments.order_details.${labelKey}`, fallback)
    );
    const getStatusText = (status, fallback) => (
        window.getPaymentStatusText ? window.getPaymentStatusText(status, fallback) : getT(`payments.status.${status}`, fallback || status)
    );
    const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';

    // Define text variables before using them
    const noOrdersText = getLabel('no_orders', 'No orders found');
    const noOrdersDesc = getLabel("no_orders_description", "You haven't placed any orders yet.");

    if (!orders || orders.length === 0) {
        ordersContainer.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-shopping-bag fa-3x text-muted mb-3"></i>
                <h5>${noOrdersText}</h5>
                <p class="text-muted">${noOrdersDesc}</p>
            </div>
        `;
        return;
    }
    const headerOrderNo = getLabel('order_number_header', 'Order Number');
    const headerDate = getLabel('date', 'Date');
    const headerAmount = getLabel('amount', 'Amount');
    const headerCredits = getLabel('credits', 'Credits');
    const headerStatus = getLabel('status', 'Status');
    const headerProduct = getLabel('product', 'Product');
    const paidLabel = getLabel('paid', 'Paid');
    const monthsLabel = getT('payments.order_details.months', 'months');

    let ordersHtml = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>${headerOrderNo}</th>
                        <th>${headerDate}</th>
                        <th>${headerAmount}</th>
                        <th>${headerCredits}</th>
                        <th>${headerStatus}</th>
                        <th>${headerProduct}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    orders.forEach(order => {
        const statusClass = getOrderStatusClass(order.status);
        ordersHtml += `
            <tr>
                <td>
                    <code>${order.order_no}</code>
                    ${order.paid_at ? `<small class="d-block text-success"><i class="fas fa-check-circle"></i> ${paidLabel}</small>` : ''}
                </td>
                <td>${formatDate(order.created_at)}</td>
                <td>${formatCurrency(order.amount, order.currency)}</td>
                <td><span class="badge bg-primary">${formatCredits(order.credits)}</span></td>
                <td><span class="badge ${statusClass}">${getStatusText(order.status, order.status)}</span></td>
                <td>
                    ${order.product_name || '-'}
                    ${order.valid_months ? `<small class="d-block text-muted">${order.valid_months} ${monthsLabel}</small>` : ''}
                </td>
            </tr>
        `;
    });

    ordersHtml += `
                </tbody>
            </table>
        </div>
    `;

    // Add pagination
    const paginationHtml = createPagination(pagination, 'goToOrdersPage');
    if (paginationHtml) {
        ordersHtml += `<div class="mt-4">${paginationHtml}</div>`;
    }

    ordersContainer.innerHTML = ordersHtml;
}

function getOrderStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'completed':
        case 'paid':
            return 'bg-success';
        case 'pending':
            return 'bg-warning';
        case 'cancelled':
            return 'bg-secondary';
        case 'failed':
            return 'bg-danger';
        case 'expired':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

function setupOrdersEventListeners() {
    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
        statusFilter.addEventListener('change', function() {
            const selectedStatus = this.value || null;
            loadOrders(1, selectedStatus);
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-orders');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            loadOrders(currentOrdersPage, currentStatusFilter);
        });
    }
}

// Pagination handler
function goToOrdersPage(page) {
    loadOrders(page, currentStatusFilter);
}

// Check for payment success status from URL parameters
function checkPaymentSuccessStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentSuccess = urlParams.get('payment_success');
    const orderId = urlParams.get('order_id');
    const reason = urlParams.get('reason');
    const status = urlParams.get('status');

    if (paymentSuccess === 'true') {
        showPaymentSuccessMessage(orderId);
        // Store order ID for highlighting after orders load
        if (orderId) {
            window.highlightOrderId = orderId;
        }
        // Clean URL to remove payment success parameters
        cleanupUrlParameters();
    } else if (paymentSuccess === 'false') {
        showPaymentErrorMessage(reason, status, orderId);
        cleanupUrlParameters();
    } else if (paymentSuccess === 'pending') {
        showPaymentPendingMessage(orderId);
        cleanupUrlParameters();
    }
}

function showPaymentSuccessMessage(orderId) {
    const alertContainer = document.createElement('div');
    alertContainer.className = 'alert alert-success alert-dismissible fade show mb-4';

    // Use the payment i18n helper if available, otherwise use language-aware fallback
    let successMessage;
    if (window.buildPaymentSuccessMessage) {
        successMessage = window.buildPaymentSuccessMessage(orderId);
    } else {
        // Use translations.js FRONTEND_TRANSLATIONS fallback
        const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';
        const translations = window.FRONTEND_TRANSLATIONS || {};
        const langTranslations = translations[currentLang] || translations.en || {};
        
        const title = langTranslations.payments?.status?.success;
        const description = langTranslations.payments?.messages?.success_description;
        const orderLabel = langTranslations.payments?.order_details?.order_id;
        successMessage = `<i class="fas fa-check-circle me-2"></i><strong>${title}</strong> ${description}${orderId ? `<div class="mt-2 small">${orderLabel}: <code>${orderId}</code></div>` : ''}`;
    }

    alertContainer.innerHTML = `
        ${successMessage}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Insert at the beginning of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const firstChild = mainContent.querySelector('.orders-header');
        if (firstChild) {
            mainContent.insertBefore(alertContainer, firstChild.nextSibling);
        } else {
            mainContent.insertBefore(alertContainer, mainContent.firstChild);
        }
    }
}

function showPaymentErrorMessage(reason, status, orderId) {
    const alertContainer = document.createElement('div');

    // Use the payment i18n helper if available, otherwise use language-aware fallback
    let errorMessage;
    if (window.buildPaymentErrorMessage) {
        const result = window.buildPaymentErrorMessage(reason, status, orderId);
        errorMessage = result.html || result;  // Handle both string and object returns
    } else {
        // Language-aware fallback with more specific error handling
        const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';
        let baseMessage = 'Payment verification failed, please contact support.';
        
        // Provide more specific messages based on status/reason
        if (status === 'cancelled') {
            baseMessage = 'Payment was cancelled. You can try placing a new order.';
        } else if (status === 'expired') {
            baseMessage = 'Payment link has expired. Please place a new order to complete payment.';
        } else if (status === 'failed') {
            baseMessage = 'Payment failed. Please check your payment information and try again.';
        } else if (reason) {
            baseMessage = `Payment failed: ${reason}. Please check your payment information and try again.`;
        }
        
        errorMessage = baseMessage;
    }

    let alertType = 'danger';
    if (status === 'cancelled' || status === 'expired') {
        alertType = 'warning';
    }

    // Language-aware order ID label
    let orderIdLabel;
    if (window.getOrderDetailsLabel) {
        const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';
        orderIdLabel = window.getOrderDetailsLabel('order_id', 'Order ID');
    } else {
        const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';
        orderIdLabel = 'Order ID';
    }

    alertContainer.className = `alert alert-${alertType} alert-dismissible fade show mb-4`;
    alertContainer.innerHTML = `
        ${errorMessage}
        ${orderId ? `<div class="mt-2 small">${orderIdLabel}: <code>${orderId}</code></div>` : ''}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Insert at the beginning of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const firstChild = mainContent.querySelector('.orders-header');
        if (firstChild) {
            mainContent.insertBefore(alertContainer, firstChild.nextSibling);
        } else {
            mainContent.insertBefore(alertContainer, mainContent.firstChild);
        }
    }
}

function showPaymentPendingMessage(orderId) {
    const alertContainer = document.createElement('div');
    alertContainer.className = 'alert alert-info alert-dismissible fade show mb-4';

    // Use the payment i18n helper if available, otherwise use language-aware fallback
    let pendingMessage;
    if (window.buildPaymentPendingMessage) {
        pendingMessage = window.buildPaymentPendingMessage(orderId);
    } else {
        // Language-aware fallback with more encouraging messaging
        const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';
        const title = 'Payment Processing';
        const description = 'Your payment is being processed. This usually takes a few seconds. Please refresh shortly to check your order status.';
        const orderPrefix = 'Order ID: ';
        pendingMessage = `<i class="fas fa-clock me-2"></i><strong>${title}:</strong> ${description}${orderId ? `<div class="mt-2 small">${orderPrefix}<code>${orderId}</code></div>` : ''}`;
    }

    // Language-aware refresh button text
    let refreshPageText;
    if (window.getPaymentAction) {
        const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';
        refreshPageText = window.getPaymentAction('refresh_page', 'Refresh Page');
    } else {
        const currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'en';
        refreshPageText = 'Refresh Page';
    }

    alertContainer.innerHTML = `
        ${pendingMessage}
        <div class="mt-2">
            <button type="button" class="btn btn-sm btn-info" onclick="window.location.reload()">
                <i class="fas fa-refresh me-1"></i>${refreshPageText}
            </button>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    // Insert at the beginning of main content
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        const firstChild = mainContent.querySelector('.orders-header');
        if (firstChild) {
            mainContent.insertBefore(alertContainer, firstChild.nextSibling);
        } else {
            mainContent.insertBefore(alertContainer, mainContent.firstChild);
        }
    }
}

function cleanupUrlParameters() {
    // Remove payment success parameters from URL without triggering page reload
    const url = new URL(window.location.href);
    url.searchParams.delete('payment_success');
    url.searchParams.delete('order_id');
    url.searchParams.delete('reason');
    url.searchParams.delete('status');

    // Update URL without reloading page
    window.history.replaceState({}, document.title, url.toString());
}

// Make function globally available
window.goToOrdersPage = goToOrdersPage;
