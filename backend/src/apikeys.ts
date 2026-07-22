import { eq, desc, and, count } from 'drizzle-orm';
import { apikeys } from './schema';
import type { Database } from './db';

// Generate UUID function for Cloudflare Workers
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export interface ApiKey {
  id: number;
  api_key: string;
  title?: string | null;
  user_uuid: string;
  created_at?: Date | null;
  status?: string | null;
}

export interface CreateApiKeyData {
  title: string;
  user_uuid: string;
}

export interface ApiKeySummary {
  total_keys: number;
  active_keys: number;
  inactive_keys: number;
}

export class ApiKeyService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // Generate API key
  private generateApiKey(): string {
    const prefix = 'sk-';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix;
    for (let i = 0; i < 48; i++) { // Generate 48 characters after prefix
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  }

  // Get user's API keys with pagination
  async getUserApiKeys(userUuid: string, limit: number = 20, offset: number = 0): Promise<ApiKey[]> {
    try {
      const result = await this.db
        .select({
          id: apikeys.id,
          api_key: apikeys.api_key,
          title: apikeys.title,
          user_uuid: apikeys.user_uuid,
          created_at: apikeys.created_at,
          status: apikeys.status,
        })
        .from(apikeys)
        .where(eq(apikeys.user_uuid, userUuid))
        .orderBy(desc(apikeys.created_at))
        .limit(limit)
        .offset(offset);

      // Mask API keys for security (show only first 12 and last 4 characters)
      return result.map(key => ({
        ...key,
        api_key: this.maskApiKey(key.api_key)
      })) as ApiKey[];
    } catch (error) {
      console.error('Get user API keys error:', error);
      throw new Error(`Failed to get user API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user's API key count
  async getUserApiKeyCount(userUuid: string): Promise<number> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(apikeys)
        .where(eq(apikeys.user_uuid, userUuid));

      return result[0]?.count || 0;
    } catch (error) {
      console.error('Get user API key count error:', error);
      throw new Error(`Failed to get user API key count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user's API key summary
  async getUserApiKeySummary(userUuid: string): Promise<ApiKeySummary> {
    try {
      const allApiKeys = await this.db
        .select()
        .from(apikeys)
        .where(eq(apikeys.user_uuid, userUuid));

      const summary: ApiKeySummary = {
        total_keys: allApiKeys.length,
        active_keys: allApiKeys.filter(key => key.status === 'active' || !key.status).length,
        inactive_keys: allApiKeys.filter(key => key.status === 'inactive').length,
      };

      return summary;
    } catch (error) {
      console.error('Get user API key summary error:', error);
      throw new Error(`Failed to get user API key summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Create new API key
  async createApiKey(data: CreateApiKeyData): Promise<ApiKey> {
    try {
      const apiKey = this.generateApiKey();
      
      const result = await this.db
        .insert(apikeys)
        .values({
          api_key: apiKey,
          title: data.title,
          user_uuid: data.user_uuid,
          created_at: new Date(),
          status: 'active',
        })
        .returning();

      const newApiKey = result[0] as ApiKey;
      
      // Return the full API key only once during creation
      return {
        ...newApiKey,
        api_key: apiKey // Return full key on creation
      };
    } catch (error) {
      console.error('Create API key error:', error);
      throw new Error(`Failed to create API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Delete API key
  async deleteApiKey(apiKeyId: number, userUuid: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(apikeys)
        .where(and(eq(apikeys.id, apiKeyId), eq(apikeys.user_uuid, userUuid)))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error('Delete API key error:', error);
      throw new Error(`Failed to delete API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Update API key status
  async updateApiKeyStatus(apiKeyId: number, userUuid: string, status: string): Promise<ApiKey | null> {
    try {
      const result = await this.db
        .update(apikeys)
        .set({ status })
        .where(and(eq(apikeys.id, apiKeyId), eq(apikeys.user_uuid, userUuid)))
        .returning();

      const updatedKey = result[0] as ApiKey;
      if (updatedKey) {
        // Mask the API key
        return {
          ...updatedKey,
          api_key: this.maskApiKey(updatedKey.api_key)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Update API key status error:', error);
      throw new Error(`Failed to update API key status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get API key by key value (for authentication)
  async getApiKeyByValue(apiKeyValue: string): Promise<ApiKey | null> {
    try {
      const result = await this.db
        .select()
        .from(apikeys)
        .where(eq(apikeys.api_key, apiKeyValue))
        .limit(1);

      return (result[0] as ApiKey) || null;
    } catch (error) {
      console.error('Get API key by value error:', error);
      throw new Error(`Failed to get API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Mask API key for display
  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 16) {
      return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4);
    }
    return apiKey.substring(0, 12) + '****' + apiKey.substring(apiKey.length - 4);
  }
}