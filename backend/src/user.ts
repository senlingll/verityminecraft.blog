import { eq, and } from 'drizzle-orm';
import { users } from './schema';
import type { Database } from './db';
import type { GoogleUserInfo, GitHubUserInfo } from './auth';
import { CreditsService } from './credits';

// Generate UUID function for Cloudflare Workers
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface CreateUserData {
  email: string;
  nickname?: string;
  avatar_url?: string;
  locale?: string;
  signin_provider: string;
  signin_openid: string;
  signin_ip?: string;
}

export interface User {
  id: number;
  uuid: string;
  email: string;
  nickname?: string | null;
  avatar_url?: string | null;
  locale?: string | null;
  signin_provider?: string | null;
  signin_openid?: string | null;
  invite_code: string;
  invited_by: string;
  is_affiliate: boolean;
  created_at?: Date | null;
  updated_at?: Date | null;
}

export class UserService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // Find user by email and provider with retry
  async findUserByEmailAndProvider(email: string, provider: string): Promise<User | null> {
    console.log(`Database query: Finding user with email=${email} and provider=${provider}`);
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Database query attempt ${attempt}/${maxRetries}`);
        
        const result = await this.db
          .select()
          .from(users)
          .where(and(eq(users.email, email), eq(users.signin_provider, provider)))
          .limit(1);
        
        console.log(`Database query result:`, result.length > 0 ? 'User found' : 'User not found');
        return (result[0] as User) || null;
        
      } catch (error) {
        console.error(`Database error in findUserByEmailAndProvider (attempt ${attempt}):`, error);
        
        if (attempt === maxRetries) {
          console.error('All database retry attempts failed');
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
  }

  // Find user by UUID
  async findUserByUuid(uuid: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.uuid, uuid))
      .limit(1);

    return (result[0] as User) || null;
  }

  // Create new user with retry mechanism
  async createUser(userData: CreateUserData): Promise<User> {
    console.log('Starting createUser with userData:', userData);
    const userUuid = generateUUID();
    const inviteCode = this.generateInviteCode();
    console.log(`Generated UUID: ${userUuid}, Invite Code: ${inviteCode}`);

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Database insert attempt ${attempt}/${maxRetries}`);
        const result = await this.db
          .insert(users)
          .values({
            uuid: userUuid,
            email: userData.email,
            nickname: userData.nickname || null,
            avatar_url: userData.avatar_url || null,
            locale: userData.locale || 'en',
            signin_type: 'oauth',
            signin_provider: userData.signin_provider,
            signin_openid: userData.signin_openid,
            signin_ip: userData.signin_ip || null,
            invite_code: inviteCode,
            created_at: new Date(),
            updated_at: new Date(),
            invited_by: '',
            is_affiliate: false,
          })
          .returning();

        console.log('Database insert completed, result:', result[0]);
        const newUser = result[0] as User;
        
        // Give welcome credits to new user
        try {
          console.log(`Giving welcome credits to new user ${userUuid}`);
          const creditsService = new CreditsService(this.db);
          await creditsService.giveWelcomeCredits(userUuid);
          console.log('Welcome credits given successfully');
        } catch (creditsError) {
          console.error('Failed to give welcome credits, but user creation succeeded:', creditsError);
          // Don't fail user creation if credits fail, but log the error
        }
        
        return newUser;
        
      } catch (error) {
        console.error(`Database error in createUser (attempt ${attempt}):`, error);
        
        if (attempt === maxRetries) {
          console.error('All database insert retry attempts failed');
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`Retrying insert in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('All createUser attempts failed');
  }

  // Update user information with retry mechanism
  async updateUser(uuid: string, updateData: Partial<CreateUserData>): Promise<User | null> {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Database update attempt ${attempt}/${maxRetries} for user ${uuid}`);
        
        const result = await this.db
          .update(users)
          .set({
            ...updateData,
            updated_at: new Date(),
          })
          .where(eq(users.uuid, uuid))
          .returning();

        console.log('Database update completed successfully');
        return (result[0] as User) || null;
        
      } catch (error) {
        console.error(`Database error in updateUser (attempt ${attempt}):`, error);
        
        if (attempt === maxRetries) {
          console.error('All database update retry attempts failed');
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`Retrying update in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return null;
  }

  // Create or update user from Google OAuth
  async createOrUpdateFromGoogle(googleUser: GoogleUserInfo, signinIp?: string): Promise<User> {
    try {
      console.log('Processing Google user:', googleUser);
      const existingUser = await this.findUserByEmailAndProvider(googleUser.email, 'google');
      console.log('Existing user lookup result:', existingUser);

      if (existingUser) {
        // Update existing user with latest info from Google
        console.log('Updating existing user:', existingUser.email);
        const updateData = {
          nickname: googleUser.name,
          avatar_url: googleUser.picture,
          locale: googleUser.locale,
          signin_ip: signinIp,
        };
        console.log('Update data:', updateData);
        const updatedUser = await this.updateUser(existingUser.uuid, updateData);
        console.log('User updated successfully:', updatedUser);
        return updatedUser!;
      } else {
        // Create new user
        console.log('Creating new user with data:', {
          email: googleUser.email,
          nickname: googleUser.name,
          avatar_url: googleUser.picture,
          locale: googleUser.locale,
          signin_provider: 'google',
          signin_openid: googleUser.id,
          signin_ip: signinIp,
        });
        const newUser = await this.createUser({
          email: googleUser.email,
          nickname: googleUser.name,
          avatar_url: googleUser.picture,
          locale: googleUser.locale,
          signin_provider: 'google',
          signin_openid: googleUser.id,
          signin_ip: signinIp,
        });
        console.log('User created successfully:', newUser);
        return newUser;
      }
    } catch (error) {
      console.error('Error in createOrUpdateFromGoogle:', error);
      throw new Error(`Failed to create or update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create or update user from GitHub OAuth
  async createOrUpdateFromGitHub(githubUser: GitHubUserInfo, signinIp?: string): Promise<User> {
    try {
      console.log('Processing GitHub user:', githubUser);
      console.log('Starting database lookup for existing user...');
      
      const existingUser = await this.findUserByEmailAndProvider(githubUser.email, 'github');
      console.log('Existing user lookup result:', existingUser);

      if (existingUser) {
        // Update existing user with latest info from GitHub
        console.log('Updating existing user:', existingUser.email);
        const updateData = {
          nickname: githubUser.name,
          avatar_url: githubUser.avatar_url,
          locale: githubUser.location || 'en', // GitHub doesn't provide locale, use location or default to 'en'
          signin_ip: signinIp,
        };
        console.log('Update data:', updateData);
        console.log('Starting user update operation...');
        const updatedUser = await this.updateUser(existingUser.uuid, updateData);
        console.log('User updated successfully:', updatedUser);
        return updatedUser!;
      } else {
        // Create new user
        console.log('Creating new user with data:', {
          email: githubUser.email,
          nickname: githubUser.name,
          avatar_url: githubUser.avatar_url,
          locale: githubUser.location || 'en',
          signin_provider: 'github',
          signin_openid: githubUser.id.toString(),
          signin_ip: signinIp,
        });
        console.log('Starting user creation operation...');
        const newUser = await this.createUser({
          email: githubUser.email,
          nickname: githubUser.name,
          avatar_url: githubUser.avatar_url,
          locale: githubUser.location || 'en',
          signin_provider: 'github',
          signin_openid: githubUser.id.toString(),
          signin_ip: signinIp,
        });
        console.log('User created successfully:', newUser);
        return newUser;
      }
    } catch (error) {
      console.error('Error in createOrUpdateFromGitHub:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`Failed to create or update user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  private generateInviteCode(): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  // Update user signin info
  async updateSigninInfo(uuid: string, signinIp?: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        signin_ip: signinIp,
        updated_at: new Date(),
      })
      .where(eq(users.uuid, uuid));
  }
}