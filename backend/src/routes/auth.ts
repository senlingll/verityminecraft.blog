import { Hono } from 'hono';
import type { Env } from '../db';
import { AuthService } from '../auth';
import { UserService } from '../user';
import { createDb } from '../db';
import { getClientIP } from '../middleware';
import { getDomainConfig, getFrontendUrl } from '../domain-config';

const authRoutes = new Hono<{ Bindings: Env }>();

// GitHub OAuth login URL
authRoutes.get('/github/url', async (c) => {
  const authService = new AuthService(c.env);
  const domainConfig = getDomainConfig(c.env);
  const redirectUri = c.req.query('redirect_uri') || domainConfig.GITHUB_CALLBACK;
  const state = c.req.query('state');
  
  const authUrl = authService.getGitHubAuthUrl(redirectUri, state);
  
  return c.json({
    success: true,
    auth_url: authUrl,
  });
});

// GitHub OAuth callback
authRoutes.post('/github/callback', async (c) => {
  try {
    const body = await c.req.json();
    const { code, redirect_uri } = body;
    
    if (!code || !redirect_uri) {
      return c.json({ error: 'Missing code or redirect_uri' }, 400);
    }

    const authService = new AuthService(c.env);
    const db = createDb(c.env);
    const userService = new UserService(db);
    const clientIP = getClientIP(c);

    // Exchange code for access token
    const accessToken = await authService.exchangeGitHubCodeForToken(code, redirect_uri);
    
    // Get user info from GitHub
    const githubUser = await authService.getGitHubUserInfo(accessToken);
    
    // Create or update user in database
    const user = await userService.createOrUpdateFromGitHub(githubUser, clientIP);
    
    // Generate JWT token
    const jwtToken = await authService.generateJWT({
      uuid: user.uuid,
      email: user.email,
      nickname: user.nickname || undefined,
      avatar_url: user.avatar_url || undefined,
      locale: user.locale || undefined,
    });

    return c.json({
      success: true,
      token: jwtToken,
      expires_in: 604800, // 7 days in seconds
      user: {
        uuid: user.uuid,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        locale: user.locale,
        invite_code: user.invite_code,
        is_affiliate: user.is_affiliate,
      },
    });
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return c.json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// GitHub OAuth callback endpoint (direct from GitHub)
authRoutes.get('/callback/github', async (c) => {
  try {
    console.log('Received GitHub OAuth callback');
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');
    
    if (error) {
      console.error('GitHub OAuth error:', error);
      // Redirect to frontend with error
      return c.redirect(`${getFrontendUrl(c.env, '/auth/callback')}?error=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
      console.error('Missing authorization code');
      return c.redirect(`${getFrontendUrl(c.env, '/auth/callback')}?error=${encodeURIComponent('Missing authorization code')}`);
    }

    console.log('Exchanging code for access token');
    const authService = new AuthService(c.env);
    console.log('AuthService created');
    
    const db = createDb(c.env);
    console.log('Database connection created');
    
    const userService = new UserService(db);
    console.log('UserService created');
    
    const clientIP = getClientIP(c);
    console.log('Client IP obtained:', clientIP);
    
    // Use the same redirect URI that was sent to GitHub
    const domainConfig = getDomainConfig(c.env);
    const redirectUri = domainConfig.GITHUB_CALLBACK;

    // Exchange code for access token
    console.log('Starting token exchange...');
    const accessToken = await authService.exchangeGitHubCodeForToken(code, redirectUri);
    console.log('Access token obtained successfully');
    
    // Get user info from GitHub
    console.log('Starting user info fetch...');
    const githubUser = await authService.getGitHubUserInfo(accessToken);
    console.log('GitHub user info obtained:', githubUser.email);
    
    // Create or update user in database
    console.log('Starting database user operation...');
    const user = await userService.createOrUpdateFromGitHub(githubUser, clientIP);
    console.log('User processed successfully:', user.email);
    
    // Generate JWT token
    console.log('Starting JWT generation...');
    const jwtToken = await authService.generateJWT({
      uuid: user.uuid,
      email: user.email,
      nickname: user.nickname || undefined,
      avatar_url: user.avatar_url || undefined,
      locale: user.locale || undefined,
    });
    console.log('JWT token generated successfully');

    // Always redirect to auth callback page first to handle token properly
    let originalRedirectUrl = '/';
    if (state) {
      try {
        // Try to decode state as JSON to get redirect URL
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.redirect_url) {
          originalRedirectUrl = stateData.redirect_url;
          console.log('Original redirect URL from state:', originalRedirectUrl);
        }
      } catch (e) {
        // If state is not JSON, treat it as simple redirect path
        if (state.startsWith('/')) {
          originalRedirectUrl = state;
          console.log('Original redirect URL from state:', originalRedirectUrl);
        }
      }
    }

    // Redirect to frontend auth callback page with token and original redirect URL
    const frontendUrl = `${getFrontendUrl(c.env, '/auth/callback')}?token=${encodeURIComponent(jwtToken)}&user=${encodeURIComponent(JSON.stringify({
      uuid: user.uuid,
      email: user.email,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      locale: user.locale,
      invite_code: user.invite_code,
      is_affiliate: user.is_affiliate,
    }))}&expires_in=604800&redirect_url=${encodeURIComponent(originalRedirectUrl)}`; // 7 days in seconds
    
    console.log('Redirecting to frontend:', frontendUrl);
    return c.redirect(frontendUrl);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    // 更详细的错误信息
    const detailedError = `Token exchange error: internal error; reference = d5kahajah59mpn1h2jsjaquu. Details: ${errorMessage}`;
    return c.redirect(`${getFrontendUrl(c.env, '/auth/callback')}?error=${encodeURIComponent(detailedError)}`);
  }
});
// Google OAuth login URL
authRoutes.get('/google/url', async (c) => {
  const authService = new AuthService(c.env);
  const domainConfig = getDomainConfig(c.env);
  const redirectUri = c.req.query('redirect_uri') || domainConfig.GOOGLE_CALLBACK;
  const state = c.req.query('state');
  
  const authUrl = authService.getGoogleAuthUrl(redirectUri, state);
  
  return c.json({
    success: true,
    auth_url: authUrl,
  });
});

// Google OAuth callback
authRoutes.post('/google/callback', async (c) => {
  try {
    const body = await c.req.json();
    const { code, redirect_uri } = body;
    
    if (!code || !redirect_uri) {
      return c.json({ error: 'Missing code or redirect_uri' }, 400);
    }

    const authService = new AuthService(c.env);
    const db = createDb(c.env);
    const userService = new UserService(db);
    const clientIP = getClientIP(c);

    // Exchange code for access token
    const accessToken = await authService.exchangeCodeForToken(code, redirect_uri);
    
    // Get user info from Google
    const googleUser = await authService.getGoogleUserInfo(accessToken);
    
    // Create or update user in database
    const user = await userService.createOrUpdateFromGoogle(googleUser, clientIP);
    
    // Generate JWT token
    const jwtToken = await authService.generateJWT({
      uuid: user.uuid,
      email: user.email,
      nickname: user.nickname || undefined,
      avatar_url: user.avatar_url || undefined,
      locale: user.locale || undefined,
    });

    return c.json({
      success: true,
      token: jwtToken,
      expires_in: 604800, // 7 days in seconds
      user: {
        uuid: user.uuid,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        locale: user.locale,
        invite_code: user.invite_code,
        is_affiliate: user.is_affiliate,
      },
    });
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return c.json({
      error: 'Authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Google OAuth callback endpoint (direct from Google)
authRoutes.get('/callback/google', async (c) => {
  try {
    console.log('Received Google OAuth callback');
    const code = c.req.query('code');
    const state = c.req.query('state');
    const error = c.req.query('error');
    
    if (error) {
      console.error('Google OAuth error:', error);
      // Redirect to frontend with error
      return c.redirect(`${getFrontendUrl(c.env, '/auth/callback')}?error=${encodeURIComponent(error)}`);
    }
    
    if (!code) {
      console.error('Missing authorization code');
      return c.redirect(`${getFrontendUrl(c.env, '/auth/callback')}?error=${encodeURIComponent('Missing authorization code')}`);
    }

    console.log('Exchanging code for access token');
    const authService = new AuthService(c.env);
    const db = createDb(c.env);
    const userService = new UserService(db);
    const clientIP = getClientIP(c);
    
    // Use the same redirect URI that was sent to Google
    const domainConfig = getDomainConfig(c.env);
    const redirectUri = domainConfig.GOOGLE_CALLBACK;

    // Exchange code for access token
    const accessToken = await authService.exchangeCodeForToken(code, redirectUri);
    console.log('Access token obtained successfully');
    
    // Get user info from Google
    const googleUser = await authService.getGoogleUserInfo(accessToken);
    console.log('Google user info obtained:', googleUser.email);
    
    // Create or update user in database
    const user = await userService.createOrUpdateFromGoogle(googleUser, clientIP);
    console.log('User processed successfully:', user.email);
    
    // Generate JWT token
    const jwtToken = await authService.generateJWT({
      uuid: user.uuid,
      email: user.email,
      nickname: user.nickname || undefined,
      avatar_url: user.avatar_url || undefined,
      locale: user.locale || undefined,
    });
    console.log('JWT token generated successfully');

    // Always redirect to auth callback page first to handle token properly
    let originalRedirectUrl = '/';
    if (state) {
      try {
        // Try to decode state as JSON to get redirect URL
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.redirect_url) {
          originalRedirectUrl = stateData.redirect_url;
          console.log('Original redirect URL from state:', originalRedirectUrl);
        }
      } catch (e) {
        // If state is not JSON, treat it as simple redirect path
        if (state.startsWith('/')) {
          originalRedirectUrl = state;
          console.log('Original redirect URL from state:', originalRedirectUrl);
        }
      }
    }

    // Redirect to frontend auth callback page with token and original redirect URL
    const frontendUrl = `${getFrontendUrl(c.env, '/auth/callback')}?token=${encodeURIComponent(jwtToken)}&user=${encodeURIComponent(JSON.stringify({
      uuid: user.uuid,
      email: user.email,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      locale: user.locale,
      invite_code: user.invite_code,
      is_affiliate: user.is_affiliate,
    }))}&expires_in=604800&redirect_url=${encodeURIComponent(originalRedirectUrl)}`; // 7 days in seconds
    
    console.log('Redirecting to frontend:', frontendUrl);
    return c.redirect(frontendUrl);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    // 更详细的错误信息
    const detailedError = `Token exchange error: internal error; reference = d5kahajah59mpn1h2jsjaquu. Details: ${errorMessage}`;
    return c.redirect(`${getFrontendUrl(c.env, '/auth/callback')}?error=${encodeURIComponent(detailedError)}`);
  }
});

// Verify token and get user info
authRoutes.get('/me', async (c) => {
  try {
    const authService = new AuthService(c.env);
    const authHeader = c.req.header('Authorization') || null;
    
    const token = authService.extractToken(authHeader);
    if (!token) {
      return c.json({ error: 'Authorization token required' }, 401);
    }

    const userPayload = await authService.verifyJWT(token);
    const db = createDb(c.env);
    const userService = new UserService(db);
    
    // Get full user info from database
    const user = await userService.findUserByUuid(userPayload.uuid);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: {
        uuid: user.uuid,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        locale: user.locale,
        invite_code: user.invite_code,
        is_affiliate: user.is_affiliate,
        created_at: user.created_at,
      },
      token_info: {
        issued_at: userPayload.iat,
        expires_at: userPayload.exp,
      },
    });
  } catch (error) {
    console.error('Get user info error:', error);
    return c.json({
      error: 'Invalid or expired token',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 401);
  }
});

// Refresh token
authRoutes.post('/refresh', async (c) => {
  try {
    const authService = new AuthService(c.env);
    const authHeader = c.req.header('Authorization') || null;
    
    const token = authService.extractToken(authHeader);
    if (!token) {
      return c.json({ error: 'Authorization token required' }, 401);
    }

    // Verify current token
    const userPayload = await authService.verifyJWT(token);
    const db = createDb(c.env);
    const userService = new UserService(db);
    
    // Get latest user info from database
    const user = await userService.findUserByUuid(userPayload.uuid);
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Generate new JWT token
    const newToken = await authService.generateJWT({
      uuid: user.uuid,
      email: user.email,
      nickname: user.nickname || undefined,
      avatar_url: user.avatar_url || undefined,
      locale: user.locale || undefined,
    });

    return c.json({
      success: true,
      token: newToken,
      expires_in: 604800, // 7 days in seconds
      user: {
        uuid: user.uuid,
        email: user.email,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        locale: user.locale,
        invite_code: user.invite_code,
        is_affiliate: user.is_affiliate,
      },
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({
      error: 'Token refresh failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 401);
  }
});

// Logout (client-side token invalidation)
authRoutes.post('/logout', async (c) => {
  try {
    // Optional: Verify token before logout to log the action
    const authService = new AuthService(c.env);
    const authHeader = c.req.header('Authorization') || null;
    
    if (authHeader) {
      const token = authService.extractToken(authHeader);
      if (token) {
        try {
          const userPayload = await authService.verifyJWT(token);
          console.log(`User ${userPayload.email} logged out`);
        } catch (error) {
          // Token might be expired or invalid, which is fine for logout
          console.log('Logout with invalid/expired token');
        }
      }
    }
    
    return c.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    // Even if there's an error, logout should still succeed
    console.error('Logout error (non-critical):', error);
    return c.json({
      success: true,
      message: 'Logged out successfully',
    });
  }
});

export default authRoutes;