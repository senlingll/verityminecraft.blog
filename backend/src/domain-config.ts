import type { Env } from './db';

/**
 * 域名配置管理 - 统一管理前后端域名配置
 * Domain Configuration Management - Centralized domain configuration for frontend and backend
 */

export interface DomainConfig {
  // API域名 / API Domain
  API_BASE: string;
  
  // 前端域名 / Frontend Domain  
  FRONTEND_BASE: string;
  
  // OAuth回调域名 / OAuth Callback Domains
  GITHUB_CALLBACK: string;
  GOOGLE_CALLBACK: string;
}

/**
 * 获取域名配置
 * Get domain configuration from environment variables with fallbacks
 */
export function getDomainConfig(env: Env): DomainConfig {
  // 从环境变量获取配置，如果没有则使用默认值
  // Get configuration from environment variables, use defaults if not available
  
  // @ts-ignore - optional binding
  const publicBaseUrl = (env as any).PUBLIC_BASE_URL as string | undefined;
  // @ts-ignore - optional binding  
  const frontendBaseUrl = (env as any).FRONTEND_BASE_URL as string | undefined;
  
  // API域名优先使用PUBLIC_BASE_URL，然后是默认值
  // API domain prioritizes PUBLIC_BASE_URL, then defaults
  const API_BASE = publicBaseUrl || 'https://api.playpokechill.blog';
  
  // 前端域名优先使用FRONTEND_BASE_URL，然后是默认值
  // Frontend domain prioritizes FRONTEND_BASE_URL, then defaults
  const FRONTEND_BASE = frontendBaseUrl || 'https://playpokechill.blog';
  
  return {
    API_BASE,
    FRONTEND_BASE,
    GITHUB_CALLBACK: `${API_BASE}/api/auth/callback/github`,
    GOOGLE_CALLBACK: `${API_BASE}/api/auth/callback/google`,
  };
}

/**
 * 获取前端重定向URL
 * Get frontend redirect URL with path
 */
export function getFrontendUrl(env: Env, path: string = '/'): string {
  const config = getDomainConfig(env);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.FRONTEND_BASE}${cleanPath}`;
}

/**
 * 获取API回调URL
 * Get API callback URL with path
 */
export function getApiUrl(env: Env, path: string = '/'): string {
  const config = getDomainConfig(env);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${config.API_BASE}${cleanPath}`;
}

/**
 * 获取CORS允许的域名列表
 * Get CORS allowed origins list
 */
export function getCorsOrigins(env: Env): string[] {
  const config = getDomainConfig(env);
  
  return [
    // 开发环境域名 / Development domains
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000', 
    'https://playpokechill.blog',  // 添加缺失的端口
    'http://localhost:5000',
    'http://localhost:5173',
    'http://localhost:3000',
    
    // 生产环境域名 / Production domains
    config.FRONTEND_BASE,
    config.API_BASE,
    
    // 备用域名 / Fallback domains
    'https://yourdomain.com'
  ];
}