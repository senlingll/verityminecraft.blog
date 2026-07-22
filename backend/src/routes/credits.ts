import { Hono } from 'hono';
import type { Env } from '../db';
import { createDb } from '../db';
import { CreditsService } from '../credits';
import { authMiddleware } from '../middleware';

const creditsRoutes = new Hono<{ Bindings: Env }>();

// Apply authentication middleware to all credits routes
creditsRoutes.use('/*', authMiddleware());

// Get user's credit transactions
creditsRoutes.get('/transactions', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    // Get pagination parameters
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = parseInt(c.req.query('offset') || '0');
    
    // Validate pagination parameters
    if (limit > 100) {
      return c.json({ error: 'Limit cannot exceed 100' }, 400);
    }
    
    if (limit < 1 || offset < 0) {
      return c.json({ error: 'Invalid pagination parameters' }, 400);
    }
    
    const db = createDb(c.env);
    const creditsService = new CreditsService(db);
    
    const transactions = await creditsService.getUserCredits(auth.user.uuid, limit, offset);
    const totalCount = await creditsService.getUserTransactionCount(auth.user.uuid);
    
    return c.json({
      success: true,
      data: {
        transactions,
        pagination: {
          limit,
          offset,
          total: totalCount,
          has_more: offset + limit < totalCount
        }
      }
    });
  } catch (error) {
    console.error('Get credit transactions error:', error);
    return c.json({
      error: 'Failed to get credit transactions',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user's credit summary
creditsRoutes.get('/summary', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const db = createDb(c.env);
    const creditsService = new CreditsService(db);
    
    const summary = await creditsService.getUserCreditSummary(auth.user.uuid);
    
    return c.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Get credit summary error:', error);
    return c.json({
      error: 'Failed to get credit summary',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get user's total credits
creditsRoutes.get('/balance', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const db = createDb(c.env);
    const creditsService = new CreditsService(db);
    
    const totalCredits = await creditsService.getUserTotalCredits(auth.user.uuid);
    
    return c.json({
      success: true,
      data: {
        total_credits: totalCredits,
        user_uuid: auth.user.uuid
      }
    });
  } catch (error) {
    console.error('Get credit balance error:', error);
    return c.json({
      error: 'Failed to get credit balance',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Add credits to user account (admin only - could be extended with proper authorization)
creditsRoutes.post('/add', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const body = await c.req.json();
    const { credits, trans_type, order_no } = body;
    
    // Validate input
    if (typeof credits !== 'number' || credits <= 0) {
      return c.json({ error: 'Invalid credits amount' }, 400);
    }
    
    if (!trans_type || typeof trans_type !== 'string') {
      return c.json({ error: 'Transaction type is required' }, 400);
    }
    
    const db = createDb(c.env);
    const creditsService = new CreditsService(db);
    
    const creditTransaction = await creditsService.addCredits({
      user_uuid: auth.user.uuid,
      trans_type,
      credits,
      order_no
    });
    
    // Get updated balance
    const newBalance = await creditsService.getUserTotalCredits(auth.user.uuid);
    
    return c.json({
      success: true,
      data: {
        transaction: creditTransaction,
        new_balance: newBalance
      }
    });
  } catch (error) {
    console.error('Add credits error:', error);
    return c.json({
      error: 'Failed to add credits',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Use credits (deduct from user account)
creditsRoutes.post('/use', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const body = await c.req.json();
    const { amount, trans_type = 'usage', order_no } = body;
    
    // Validate input
    if (typeof amount !== 'number' || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }
    
    const db = createDb(c.env);
    const creditsService = new CreditsService(db);
    
    try {
      const creditTransaction = await creditsService.useCredits(
        auth.user.uuid,
        amount,
        trans_type,
        order_no
      );
      
      // Get updated balance
      const newBalance = await creditsService.getUserTotalCredits(auth.user.uuid);
      
      return c.json({
        success: true,
        data: {
          transaction: creditTransaction,
          new_balance: newBalance
        }
      });
    } catch (creditsError) {
      if (creditsError instanceof Error && creditsError.message.includes('insufficient_credits')) {
        return c.json({
          error_code: 'insufficient_credits',
          error_type: 'insufficient_credits'
        }, 402);
      }
      throw creditsError;
    }
  } catch (error) {
    console.error('Use credits error:', error);
    return c.json({
      error: 'Failed to use credits',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// Get transaction by transaction number
creditsRoutes.get('/transaction/:transNo', async (c) => {
  try {
    const auth = c.get('auth');
    
    if (!auth.user) {
      return c.json({ error: 'User not authenticated' }, 401);
    }
    
    const transNo = c.req.param('transNo');
    
    if (!transNo) {
      return c.json({ error: 'Transaction number is required' }, 400);
    }
    
    const db = createDb(c.env);
    const creditsService = new CreditsService(db);
    
    const transaction = await creditsService.getCreditByTransactionNo(transNo);
    
    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404);
    }
    
    // Ensure user can only access their own transactions
    if (transaction.user_uuid !== auth.user.uuid) {
      return c.json({ error: 'Access denied' }, 403);
    }
    
    return c.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    return c.json({
      error: 'Failed to get transaction',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default creditsRoutes
