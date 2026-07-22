import { SignJWT, jwtVerify } from 'jose';
import type { Env } from './db';

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
  locale: string;
}

export interface GitHubUserInfo {
  id: number;
  login: string;
  email: string;
  name: string;
  avatar_url: string;
  location?: string;
}

export interface UserPayload {
  uuid: string;
  email: string;
  nickname?: string;
  avatar_url?: string;
  locale?: string;
  [key: string]: any;
}

export class AuthService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // Get Google OAuth URL
  getGoogleAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    if (state) {
      params.set('state', state);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Get GitHub OAuth URL
  getGitHubAuthUrl(redirectUri: string, state?: string): string {
    const params = new URLSearchParams({
      client_id: this.env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'user:email',
      state: state || '',
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for Google access token
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<string> {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.env.GOOGLE_CLIENT_ID,
          client_secret: this.env.GOOGLE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange failed:', response.status, errorText);
        throw new Error(`Failed to exchange code for token: ${response.status} ${response.statusText}. ${errorText}`);
      }

      const data = await response.json() as { access_token: string };
      return data.access_token;
    } catch (error) {
      console.error('Error in exchangeCodeForToken:', error);
      if (error instanceof Error) {
        if (error.message.includes('fetch failed')) {
          throw new Error(`Token exchange error: Network error or invalid redirect URI. Please check your Google OAuth configuration. Details: ${error.message}`);
        }
        throw new Error(`Token exchange error: ${error.message}`);
      }
      throw new Error(`Token exchange error: Unknown error occurred during token exchange`);
    }
  }

  // Exchange authorization code for GitHub access token
  async exchangeGitHubCodeForToken(code: string, redirectUri: string): Promise<string> {
    try {
      console.log('GitHub OAuth token exchange started');
      console.log('Client ID:', this.env.GITHUB_CLIENT_ID);
      console.log('Redirect URI:', redirectUri);
      console.log('Code length:', code?.length);
      console.log('Environment check:', {
        hasClientId: !!this.env.GITHUB_CLIENT_ID,
        hasClientSecret: !!this.env.GITHUB_CLIENT_SECRET,
        clientSecretLength: this.env.GITHUB_CLIENT_SECRET?.length,
        clientSecretPrefix: this.env.GITHUB_CLIENT_SECRET?.substring(0, 8) + '...'
      });
      
      // Validate required parameters
      if (!this.env.GITHUB_CLIENT_ID) {
        throw new Error('GitHub Client ID is missing');
      }
      if (!this.env.GITHUB_CLIENT_SECRET) {
        throw new Error('GitHub Client Secret is missing');
      }
      if (!code) {
        throw new Error('Authorization code is missing');
      }
      if (!redirectUri) {
        throw new Error('Redirect URI is missing');
      }
      
      const requestBody = new URLSearchParams({
        client_id: this.env.GITHUB_CLIENT_ID,
        client_secret: this.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      });
      
      console.log('Request body params:', {
        client_id: this.env.GITHUB_CLIENT_ID,
        redirect_uri: redirectUri,
        code_prefix: code?.substring(0, 10) + '...',
        has_secret: !!this.env.GITHUB_CLIENT_SECRET
      });
      
      console.log('Making request to GitHub...');
      
      // Try with simplified headers first and add timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('GitHub request timeout triggered (30s)');
        controller.abort();
      }, 30000); // 30 second timeout (increased from 15s)
      
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: requestBody.toString(),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      console.log('GitHub request completed successfully');

      console.log('GitHub response received');
      console.log('GitHub response status:', response.status);
      console.log('GitHub response ok:', response.ok);
      
      // Get response headers safely
      try {
        const headers = Object.fromEntries(response.headers.entries());
        console.log('GitHub response headers:', headers);
      } catch (headerError) {
        console.log('Could not read response headers:', headerError);
      }

      if (!response.ok) {
        console.error('Response not ok, reading error text...');
        let errorText = 'Could not read error response';
        try {
          errorText = await response.text();
        } catch (readError) {
          console.error('Could not read error response:', readError);
        }
        
        console.error('GitHub token exchange failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        });
        throw new Error(`Failed to exchange code for token: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }

      console.log('Reading response body...');
      let responseText = '';
      try {
        responseText = await response.text();
        console.log('GitHub response body:', responseText);
      } catch (readError) {
        console.error('Could not read response body:', readError);
        throw new Error(`Could not read GitHub response: ${readError}`);
      }
      
      console.log('Parsing JSON response...');
      let data;
      try {
        data = JSON.parse(responseText);
        console.log('Successfully parsed JSON response');
      } catch (parseError) {
        console.error('Failed to parse GitHub response as JSON:', parseError);
        console.error('Raw response text:', responseText);
        throw new Error(`Invalid JSON response from GitHub: ${responseText}`);
      }
      
      console.log('Parsed response data:', {
        has_access_token: !!data.access_token,
        has_error: !!data.error,
        error: data.error,
        error_description: data.error_description,
        keys: Object.keys(data)
      });
      
      if (data.error) {
        throw new Error(`GitHub OAuth error: ${data.error}${data.error_description ? ` - ${data.error_description}` : ''}`);
      }
      
      if (!data.access_token) {
        throw new Error(`No access token in GitHub response: ${JSON.stringify(data)}`);
      }
      
      console.log('Token exchange successful');
      return data.access_token;
    } catch (error) {
      console.error('Error in exchangeGitHubCodeForToken:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Handle specific error types
        if (error.name === 'AbortError') {
          throw new Error('GitHub token exchange timeout: Request took longer than 30 seconds. This may be due to network issues or GitHub API being slow. Please try again.');
        }
        
        if (error.message.includes('fetch failed') || error.message.includes('network')) {
          throw new Error(`GitHub token exchange error: Network error or invalid redirect URI. Please check your GitHub OAuth configuration. Details: ${error.message}`);
        }
        
        if (error.message.includes('timeout')) {
          throw new Error(`GitHub token exchange timeout: ${error.message}`);
        }
        
        throw new Error(`GitHub token exchange error: ${error.message}`);
      }
      throw new Error(`GitHub token exchange error: Unknown error occurred during token exchange`);
    }
  }

  // Get user info from Google
  async getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google user info request failed:', response.status, errorText);
        throw new Error(`Failed to get user info from Google: ${response.status} ${response.statusText}. ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error in getGoogleUserInfo:', error);
      throw new Error(`Google user info error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user info from GitHub
  async getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
    try {
      // Get user profile
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'ImgGenerator-App',
        },
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('GitHub user info request failed:', userResponse.status, errorText);
        throw new Error(`Failed to get user info from GitHub: ${userResponse.status} ${userResponse.statusText}. ${errorText}`);
      }

      const userInfo = await userResponse.json() as any;

      // Get user email if not public
      if (!userInfo.email) {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `token ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'ImgGenerator-App',
          },
        });

        if (emailResponse.ok) {
          const emails = await emailResponse.json() as any;
          const primaryEmail = emails.find((email: any) => email.primary);
          if (primaryEmail) {
            userInfo.email = primaryEmail.email;
          }
        }
      }

      return {
        id: userInfo.id,
        login: userInfo.login,
        email: userInfo.email || '',
        name: userInfo.name || userInfo.login,
        avatar_url: userInfo.avatar_url,
        location: userInfo.location,
      };
    } catch (error) {
      console.error('Error in getGitHubUserInfo:', error);
      throw new Error(`GitHub user info error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Generate JWT token
  async generateJWT(payload: UserPayload): Promise<string> {
    const secret = new TextEncoder().encode(this.env.JWT_SECRET);
    
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .setIssuer('imggen-api')
      .setAudience('imggen-app')
      .sign(secret);
  }

  // Verify JWT token
  async verifyJWT(token: string): Promise<UserPayload> {
    const secret = new TextEncoder().encode(this.env.JWT_SECRET);
    
    try {
      const { payload } = await jwtVerify(token, secret, {
        issuer: 'imggen-api',
        audience: 'imggen-app',
      });
      
      return payload as unknown as UserPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Extract token from Authorization header
  extractToken(authHeader: string | null): string | null {
    if (!authHeader) return null;
    
    const match = authHeader.match(/^Bearer\s+(.+)$/);
    return match ? match[1] : null;
  }
}