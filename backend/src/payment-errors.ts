/**
 * Payment Error Codes and Helper Functions
 * 
 * This file defines standardized error codes for payment operations
 * and provides helper functions to return consistent error responses.
 */

export interface PaymentErrorResponse {
    success: false;
    code: string;
    message: string;
}

export interface PaymentSuccessResponse {
    success: true;
    [key: string]: any;
}

export type PaymentResponse = PaymentErrorResponse | PaymentSuccessResponse;

// Payment Error Codes
export const PAYMENT_ERROR_CODES = {
    // Authentication errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    
    // Validation errors
    MISSING_PRODUCT_ID: 'MISSING_PRODUCT_ID',
    
    // Configuration errors
    API_KEY_NOT_CONFIGURED: 'API_KEY_NOT_CONFIGURED',
    WEBHOOK_NOT_CONFIGURED: 'WEBHOOK_NOT_CONFIGURED',
    
    // External service errors
    API_ERROR: 'API_ERROR',
    
    // Security errors
    INVALID_SIGNATURE: 'INVALID_SIGNATURE',
    
    // Generic errors
    INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export type PaymentErrorCode = keyof typeof PAYMENT_ERROR_CODES;

// Error code to message mapping (for logging and fallback)
const ERROR_MESSAGES: Record<string, string> = {
    [PAYMENT_ERROR_CODES.UNAUTHORIZED]: 'Authentication required',
    [PAYMENT_ERROR_CODES.MISSING_PRODUCT_ID]: 'Product ID is required',
    [PAYMENT_ERROR_CODES.API_KEY_NOT_CONFIGURED]: 'Payment API key not configured',
    [PAYMENT_ERROR_CODES.WEBHOOK_NOT_CONFIGURED]: 'Payment webhook not configured',
    [PAYMENT_ERROR_CODES.API_ERROR]: 'Payment service error',
    [PAYMENT_ERROR_CODES.INVALID_SIGNATURE]: 'Invalid payment signature',
    [PAYMENT_ERROR_CODES.INTERNAL_ERROR]: 'Internal server error'
};

/**
 * Create a standardized payment error response
 * @param code - Payment error code
 * @param customMessage - Optional custom message (defaults to standard message)
 * @returns PaymentErrorResponse object
 */
export function createPaymentError(
    code: keyof typeof PAYMENT_ERROR_CODES, 
    customMessage?: string
): PaymentErrorResponse {
    const message = customMessage || ERROR_MESSAGES[PAYMENT_ERROR_CODES[code]] || 'Unknown error';
    
    return {
        success: false,
        code: PAYMENT_ERROR_CODES[code],
        message
    };
}

/**
 * Helper function to send JSON error response
 * @param c - Hono context
 * @param code - Payment error code
 * @param customMessage - Optional custom message
 * @param status - HTTP status code (defaults to 400)
 * @returns JSON response
 */
export function jsonError(
    c: any, 
    code: keyof typeof PAYMENT_ERROR_CODES, 
    customMessage?: string, 
    status: number = 400
) {
    const error = createPaymentError(code, customMessage);
    console.error(`[PaymentError][${error.code}] ${error.message}`);
    return c.json(error, status);
}

/**
 * Helper function to send JSON success response
 * @param c - Hono context
 * @param data - Response data
 * @returns JSON response
 */
export function jsonSuccess(c: any, data: Record<string, any> = {}) {
    return c.json({
        success: true,
        ...data
    });
}

// Redirect reason codes (for query parameters)
export const REDIRECT_REASONS = {
    SERVER_CONFIG_ERROR: 'server_config_error',
    INVALID_SIGNATURE: 'invalid_signature',
    SERVER_ERROR: 'server_error',
    ORDER_NOT_FOUND: 'order_not_found'
} as const;

export type RedirectReason = keyof typeof REDIRECT_REASONS;
