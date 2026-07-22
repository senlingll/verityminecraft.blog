import { eq, desc, and, count } from 'drizzle-orm';
import { affiliates, users, orders } from './schema';
import type { Database } from './db';

export interface Invite {
  id: number;
  user_uuid: string;
  created_at?: Date | null;
  status: string;
  invited_by: string;
  paid_order_no: string;
  paid_amount: number;
  reward_percent: number;
  reward_amount: number;
}

export interface InviteWithUserInfo extends Invite {
  invited_user_email?: string | null;
  invited_user_nickname?: string | null;
  order_info?: {
    order_no: string;
    amount: number;
    credits: number;
    status: string;
    paid_at?: Date | null;
  } | null;
}

export interface InviteSummary {
  total_invites: number;
  successful_invites: number;
  total_reward_amount: number;
  pending_rewards: number;
  completed_rewards: number;
}

export class InviteService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // Get user's invites with pagination
  async getUserInvites(userUuid: string, limit: number = 20, offset: number = 0): Promise<InviteWithUserInfo[]> {
    try {
      // First get the user's invite code
      const inviterResult = await this.db
        .select({ invite_code: users.invite_code })
        .from(users)
        .where(eq(users.uuid, userUuid))
        .limit(1);

      if (!inviterResult[0]?.invite_code) {
        return [];
      }

      const inviteCode = inviterResult[0].invite_code;

      // Get affiliates data for users invited by this user
      const result = await this.db
        .select({
          id: affiliates.id,
          user_uuid: affiliates.user_uuid,
          created_at: affiliates.created_at,
          status: affiliates.status,
          invited_by: affiliates.invited_by,
          paid_order_no: affiliates.paid_order_no,
          paid_amount: affiliates.paid_amount,
          reward_percent: affiliates.reward_percent,
          reward_amount: affiliates.reward_amount,
          invited_user_email: users.email,
          invited_user_nickname: users.nickname,
        })
        .from(affiliates)
        .leftJoin(users, eq(affiliates.user_uuid, users.uuid))
        .where(eq(affiliates.invited_by, inviteCode))
        .orderBy(desc(affiliates.created_at))
        .limit(limit)
        .offset(offset);

      // Get order information for each invite
      const invitesWithOrderInfo: InviteWithUserInfo[] = [];
      
      for (const invite of result) {
        let orderInfo = null;
        
        if (invite.paid_order_no) {
          const orderResult = await this.db
            .select({
              order_no: orders.order_no,
              amount: orders.amount,
              credits: orders.credits,
              status: orders.status,
              paid_at: orders.paid_at,
            })
            .from(orders)
            .where(eq(orders.order_no, invite.paid_order_no))
            .limit(1);
          
          orderInfo = orderResult[0] || null;
        }

        invitesWithOrderInfo.push({
          id: invite.id,
          user_uuid: invite.user_uuid,
          created_at: invite.created_at,
          status: invite.status,
          invited_by: invite.invited_by,
          paid_order_no: invite.paid_order_no,
          paid_amount: invite.paid_amount,
          reward_percent: invite.reward_percent,
          reward_amount: invite.reward_amount,
          invited_user_email: invite.invited_user_email,
          invited_user_nickname: invite.invited_user_nickname,
          order_info: orderInfo,
        });
      }

      return invitesWithOrderInfo;
    } catch (error) {
      console.error('Get user invites error:', error);
      throw new Error(`Failed to get user invites: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user's invite count
  async getUserInviteCount(userUuid: string): Promise<number> {
    try {
      // Get user's invite code
      const inviterResult = await this.db
        .select({ invite_code: users.invite_code })
        .from(users)
        .where(eq(users.uuid, userUuid))
        .limit(1);

      if (!inviterResult[0]?.invite_code) {
        return 0;
      }

      const inviteCode = inviterResult[0].invite_code;

      const result = await this.db
        .select({ count: count() })
        .from(affiliates)
        .where(eq(affiliates.invited_by, inviteCode));

      return result[0]?.count || 0;
    } catch (error) {
      console.error('Get user invite count error:', error);
      throw new Error(`Failed to get user invite count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user's invite summary
  async getUserInviteSummary(userUuid: string): Promise<InviteSummary> {
    try {
      // Get user's invite code
      const inviterResult = await this.db
        .select({ invite_code: users.invite_code })
        .from(users)
        .where(eq(users.uuid, userUuid))
        .limit(1);

      if (!inviterResult[0]?.invite_code) {
        return {
          total_invites: 0,
          successful_invites: 0,
          total_reward_amount: 0,
          pending_rewards: 0,
          completed_rewards: 0,
        };
      }

      const inviteCode = inviterResult[0].invite_code;

      const allInvites = await this.db
        .select()
        .from(affiliates)
        .where(eq(affiliates.invited_by, inviteCode));

      const summary: InviteSummary = {
        total_invites: allInvites.length,
        successful_invites: allInvites.filter(invite => invite.paid_amount > 0).length,
        total_reward_amount: allInvites.reduce((sum, invite) => sum + invite.reward_amount, 0),
        pending_rewards: allInvites.filter(invite => invite.status === 'pending').reduce((sum, invite) => sum + invite.reward_amount, 0),
        completed_rewards: allInvites.filter(invite => invite.status === 'completed').reduce((sum, invite) => sum + invite.reward_amount, 0),
      };

      return summary;
    } catch (error) {
      console.error('Get user invite summary error:', error);
      throw new Error(`Failed to get user invite summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user's invite code
  async getUserInviteCode(userUuid: string): Promise<string | null> {
    try {
      const result = await this.db
        .select({ invite_code: users.invite_code })
        .from(users)
        .where(eq(users.uuid, userUuid))
        .limit(1);

      return result[0]?.invite_code || null;
    } catch (error) {
      console.error('Get user invite code error:', error);
      throw new Error(`Failed to get user invite code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get invites by status
  async getUserInvitesByStatus(userUuid: string, status: string, limit: number = 20, offset: number = 0): Promise<InviteWithUserInfo[]> {
    try {
      // Get user's invite code
      const inviterResult = await this.db
        .select({ invite_code: users.invite_code })
        .from(users)
        .where(eq(users.uuid, userUuid))
        .limit(1);

      if (!inviterResult[0]?.invite_code) {
        return [];
      }

      const inviteCode = inviterResult[0].invite_code;

      const result = await this.db
        .select({
          id: affiliates.id,
          user_uuid: affiliates.user_uuid,
          created_at: affiliates.created_at,
          status: affiliates.status,
          invited_by: affiliates.invited_by,
          paid_order_no: affiliates.paid_order_no,
          paid_amount: affiliates.paid_amount,
          reward_percent: affiliates.reward_percent,
          reward_amount: affiliates.reward_amount,
          invited_user_email: users.email,
          invited_user_nickname: users.nickname,
        })
        .from(affiliates)
        .leftJoin(users, eq(affiliates.user_uuid, users.uuid))
        .where(and(eq(affiliates.invited_by, inviteCode), eq(affiliates.status, status)))
        .orderBy(desc(affiliates.created_at))
        .limit(limit)
        .offset(offset);

      // Convert to InviteWithUserInfo format
      return result.map(invite => ({
        id: invite.id,
        user_uuid: invite.user_uuid,
        created_at: invite.created_at,
        status: invite.status,
        invited_by: invite.invited_by,
        paid_order_no: invite.paid_order_no,
        paid_amount: invite.paid_amount,
        reward_percent: invite.reward_percent,
        reward_amount: invite.reward_amount,
        invited_user_email: invite.invited_user_email,
        invited_user_nickname: invite.invited_user_nickname,
        order_info: null, // Can be populated separately if needed
      }));
    } catch (error) {
      console.error('Get user invites by status error:', error);
      throw new Error(`Failed to get user invites by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}