import { Context, Next } from 'hono';
import type { Env } from './db';
import { AuthService, UserPayload } from './auth';
import { UserService } from './user';

export interface AuthContext {
  user: UserPayload | null;
  isAuthenticated: boolean;
}

// Extend Hono context to include auth info
declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export function authMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authService = new AuthService(c.env);
    const authHeader = c.req.header('Authorization') || null;
    
    try {
      const token = authService.extractToken(authHeader);
      
      if (!token) {
        c.set('auth', { user: null, isAuthenticated: false });
        return c.json({ error: 'Authorization token required' }, 401);
      }

      const user = await authService.verifyJWT(token);
      c.set('auth', { user, isAuthenticated: true });
      
      await next();
    } catch (error) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }
  };
}

// Optional auth middleware - doesn't require authentication but extracts user if available
export function optionalAuthMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const authService = new AuthService(c.env);
    const authHeader = c.req.header('Authorization') || null;
    
    try {
      const token = authService.extractToken(authHeader);
      
      if (token) {
        const user = await authService.verifyJWT(token);
        c.set('auth', { user, isAuthenticated: true });
      } else {
        c.set('auth', { user: null, isAuthenticated: false });
      }
    } catch (error) {
      // If token is invalid, continue without auth
      c.set('auth', { user: null, isAuthenticated: false });
    }
    
    await next();
  };
}

// Get client IP address
export function getClientIP(c: Context): string {
  // Try CF-Connecting-IP first (Cloudflare)
  const cfIP = c.req.header('CF-Connecting-IP');
  if (cfIP) return cfIP;
  
  // Try X-Forwarded-For
  const forwardedFor = c.req.header('X-Forwarded-For');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try X-Real-IP
  const realIP = c.req.header('X-Real-IP');
  if (realIP) return realIP;
  
  // Fallback
  return 'unknown';
}