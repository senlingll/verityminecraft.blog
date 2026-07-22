import { eq, desc, and } from 'drizzle-orm';
import { credits } from './schema';
import type { Database } from './db';
import { CREDITS, CREDIT_TRANSACTION_TYPES } from './constants';

// Generate transaction number function
function generateTransactionNo(): string {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return timestamp + random;
}

export interface CreateCreditData {
  user_uuid: string;
  trans_type: string;
  credits: number;
  order_no?: string;
  expired_at?: Date;
}

export interface Credit {
  id: number;
  trans_no: string;
  created_at?: Date | null;
  user_uuid: string;
  trans_type: string;
  credits: number;
  order_no?: string | null;
  expired_at?: Date | null;
}

export interface CreditSummary {
  total_credits: number;
  total_transactions: number;
  latest_transaction?: Credit | null;
}

export class CreditsService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // Get user's credit transactions with pagination
  async getUserCredits(userUuid: string, limit: number = 20, offset: number = 0): Promise<Credit[]> {
    console.log(`Getting credits for user ${userUuid}, limit: ${limit}, offset: ${offset}`);
    
    try {
      const result = await this.db
        .select()
        .from(credits)
        .where(eq(credits.user_uuid, userUuid))
        .orderBy(desc(credits.created_at))
        .limit(limit)
        .offset(offset);

      console.log(`Found ${result.length} credit transactions for user ${userUuid}`);
      return result as Credit[];
    } catch (error) {
      console.error('Error getting user credits:', error);
      throw error;
    }
  }

  // Get user's total credits (sum of all positive transactions minus negative ones)
  async getUserTotalCredits(userUuid: string): Promise<number> {
    console.log(`Calculating total credits for user ${userUuid}`);
    
    try {
      const result = await this.db
        .select()
        .from(credits)
        .where(eq(credits.user_uuid, userUuid));

      const totalCredits = result.reduce((total, credit) => {
        return total + (credit.credits || 0);
      }, 0);

      console.log(`Total credits for user ${userUuid}: ${totalCredits}`);
      return Math.max(0, totalCredits); // Ensure non-negative
    } catch (error) {
      console.error('Error calculating total credits:', error);
      throw error;
    }
  }

  // Get user's credit summary
  async getUserCreditSummary(userUuid: string): Promise<CreditSummary> {
    console.log(`Getting credit summary for user ${userUuid}`);
    
    try {
      const [transactions, totalCredits] = await Promise.all([
        this.getUserCredits(userUuid, 1, 0), // Get latest transaction
        this.getUserTotalCredits(userUuid)
      ]);

      const totalTransactions = await this.getUserTransactionCount(userUuid);

      return {
        total_credits: totalCredits,
        total_transactions: totalTransactions,
        latest_transaction: transactions[0] || null
      };
    } catch (error) {
      console.error('Error getting credit summary:', error);
      throw error;
    }
  }

  // Get user's total transaction count
  async getUserTransactionCount(userUuid: string): Promise<number> {
    try {
      const result = await this.db
        .select()
        .from(credits)
        .where(eq(credits.user_uuid, userUuid));

      return result.length;
    } catch (error) {
      console.error('Error getting transaction count:', error);
      throw error;
    }
  }

  // Add credits to user account
  async addCredits(creditData: CreateCreditData): Promise<Credit> {
    console.log('Adding credits:', creditData);
    
    const transNo = generateTransactionNo();
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Database insert attempt ${attempt}/${maxRetries} for transaction ${transNo}`);
        
        const result = await this.db
          .insert(credits)
          .values({
            trans_no: transNo,
            user_uuid: creditData.user_uuid,
            trans_type: creditData.trans_type,
            credits: creditData.credits,
            order_no: creditData.order_no || null,
            expired_at: creditData.expired_at || null,
            created_at: new Date(),
          })
          .returning();

        console.log('Credits added successfully:', result[0]);
        return result[0] as Credit;
        
      } catch (error) {
        console.error(`Database error in addCredits (attempt ${attempt}):`, error);
        
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
    
    throw new Error('All addCredits attempts failed');
  }

  // Subtract credits from user account (for usage)
  async useCredits(userUuid: string, amount: number, transType: string = 'usage', orderNo?: string): Promise<Credit> {
    console.log(`Using ${amount} credits for user ${userUuid}`);
    
    // Check if user has enough credits
    const totalCredits = await this.getUserTotalCredits(userUuid);
    if (totalCredits < amount) {
      throw new Error(`insufficient_credits:${totalCredits}:${amount}`);
    }

    // Create negative credit entry
    return await this.addCredits({
      user_uuid: userUuid,
      trans_type: transType,
      credits: -amount, // Negative for usage
      order_no: orderNo,
    });
  }

  // Give welcome credits to new user
  async giveWelcomeCredits(userUuid: string): Promise<Credit> {
    console.log(`Giving welcome credits to new user ${userUuid}`);
    
    return await this.addCredits({
      user_uuid: userUuid,
      trans_type: CREDIT_TRANSACTION_TYPES.NEW_USER,
      credits: CREDITS.WELCOME_CREDITS,
    });
  }

  // Check if user has already received welcome credits
  async hasReceivedWelcomeCredits(userUuid: string): Promise<boolean> {
    console.log(`Checking if user ${userUuid} has received welcome credits`);
    
    try {
      const result = await this.db
        .select()
        .from(credits)
        .where(and(
          eq(credits.user_uuid, userUuid),
          eq(credits.trans_type, CREDIT_TRANSACTION_TYPES.NEW_USER)
        ))
        .limit(1);

      const hasReceived = result.length > 0;
      console.log(`User ${userUuid} welcome credits status: ${hasReceived ? 'already received' : 'not received'}`);
      return hasReceived;
    } catch (error) {
      console.error('Error checking welcome credits:', error);
      throw error;
    }
  }

  // Get credits by transaction number
  async getCreditByTransactionNo(transNo: string): Promise<Credit | null> {
    try {
      const result = await this.db
        .select()
        .from(credits)
        .where(eq(credits.trans_no, transNo))
        .limit(1);

      return (result[0] as Credit) || null;
    } catch (error) {
      console.error('Error getting credit by transaction number:', error);
      throw error;
    }
  }
}