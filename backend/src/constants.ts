// Credit costs for different services
export const CREDITS = {
  // Style transfer operations (OpenRouter)
  STYLE_TRANSFER: 2,
  
  // Welcome credits for new users
  WELCOME_CREDITS: 4,
} as const;

// Credit transaction types
export const CREDIT_TRANSACTION_TYPES = {
  // Usage types
  OPENROUTER_STYLE_TRANSFER: 'openrouter_style_transfer',
  
  // Refund types
  OPENROUTER_REFUND: 'openrouter_refund',
  
  // System types
  NEW_USER: 'new_user',
  PURCHASE: 'purchase',
} as const;
