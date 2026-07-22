/**
 * Anonymous Rate Limiting Service
 * Tracks API calls for anonymous users based on IP address
 */

type D1Database = any;

export interface RateLimitConfig {
  maxCalls: number;      // Maximum calls per day
  endpoint: string;      // API endpoint name
}

export interface RateLimitResult {
  allowed: boolean;      // Whether the call is allowed
  remaining: number;     // Remaining calls for today
  resetAt: string;       // ISO timestamp when limit resets
  message?: string;      // Error message if not allowed
}

export interface CallStatus {
  count: number;         // Current call count
  date: string;          // Last call date (YYYY-MM-DD)
}

export class AnonymousRateLimitService {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Check if the call is allowed and record it
   * @param identifier - User identifier (usually IP address)
   * @param endpoint - API endpoint name
   * @param maxCalls - Maximum calls allowed per day
   * @returns RateLimitResult
   */
  async checkAndRecordCall(
    identifier: string,
    endpoint: string,
    maxCalls: number
  ): Promise<RateLimitResult> {
    const today = this.getTodayDate();
    const resetAt = this.getNextDayMidnight();

    try {
      // Query current record
      const record: any = await this.db
        .prepare(`
          SELECT call_count, last_call_date 
          FROM anonymous_api_limits 
          WHERE identifier = ? AND api_endpoint = ?
        `)
        .bind(identifier, endpoint)
        .first();

      // If no record or date is not today, create/reset record
      if (!record || record.last_call_date !== today) {
        await this.db
          .prepare(`
            INSERT INTO anonymous_api_limits 
            (identifier, api_endpoint, call_count, last_call_date, updated_at)
            VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(identifier, api_endpoint) 
            DO UPDATE SET 
              call_count = 1, 
              last_call_date = ?, 
              updated_at = CURRENT_TIMESTAMP
          `)
          .bind(identifier, endpoint, today, today)
          .run();

        return {
          allowed: true,
          remaining: maxCalls - 1,
          resetAt,
        };
      }

      // Check if limit exceeded
      if (record.call_count >= maxCalls) {
        return {
          allowed: false,
          remaining: 0,
          resetAt,
          message: `Daily limit of ${maxCalls} free tests exceeded. Please try again tomorrow.`,
        };
      }

      // Increment call count
      await this.db
        .prepare(`
          UPDATE anonymous_api_limits 
          SET call_count = call_count + 1, updated_at = CURRENT_TIMESTAMP
          WHERE identifier = ? AND api_endpoint = ?
        `)
        .bind(identifier, endpoint)
        .run();

      return {
        allowed: true,
        remaining: maxCalls - record.call_count - 1,
        resetAt,
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // On error, allow the call but log it
      return {
        allowed: true,
        remaining: maxCalls - 1,
        resetAt,
      };
    }
  }

  /**
   * Get current call status for a user
   * @param identifier - User identifier
   * @param endpoint - API endpoint name
   * @returns CallStatus
   */
  async getCallStatus(
    identifier: string,
    endpoint: string
  ): Promise<CallStatus> {
    const today = this.getTodayDate();

    try {
      const record: any = await this.db
        .prepare(`
          SELECT call_count, last_call_date 
          FROM anonymous_api_limits 
          WHERE identifier = ? AND api_endpoint = ?
        `)
        .bind(identifier, endpoint)
        .first();

      if (!record || record.last_call_date !== today) {
        return { count: 0, date: today };
      }

      return {
        count: record.call_count,
        date: record.last_call_date,
      };
    } catch (error) {
      console.error('Get call status error:', error);
      return { count: 0, date: today };
    }
  }

  /**
   * Clean up old records (older than 30 days)
   * Should be called periodically
   */
  async cleanupOldRecords(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];

    try {
      await this.db
        .prepare(`
          DELETE FROM anonymous_api_limits 
          WHERE last_call_date < ?
        `)
        .bind(cutoffDate)
        .run();
    } catch (error) {
      console.error('Cleanup old records error:', error);
    }
  }

  /**
   * Get today's date in YYYY-MM-DD format
   */
  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get next day midnight in ISO format
   */
  private getNextDayMidnight(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
}
