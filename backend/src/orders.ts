import { eq, desc, and, count, or } from 'drizzle-orm';
import { orders } from './schema';
import type { Database } from './db';

export interface Order {
  id: number;
  order_no: string;
  created_at?: Date | null;
  user_uuid: string;
  user_email: string;
  amount: number;
  interval?: string | null;
  expired_at?: Date | null;
  status: string;
  stripe_session_id?: string | null;
  credits: number;
  currency?: string | null;
  sub_id?: string | null;
  sub_interval_count?: number | null;
  sub_cycle_anchor?: number | null;
  sub_period_end?: number | null;
  sub_period_start?: number | null;
  sub_times?: number | null;
  product_id?: string | null;
  product_name?: string | null;
  valid_months?: number | null;
  order_detail?: string | null;
  paid_at?: Date | null;
  paid_email?: string | null;
  paid_detail?: string | null;
}

export interface OrderSummary {
  total_orders: number;
  total_amount: number;
  total_credits: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
}

export class OrderService {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // Get user's orders with pagination
  async getUserOrders(userUuid: string, limit: number = 20, offset: number = 0): Promise<Order[]> {
    try {
      console.log('[DEBUG] getUserOrders called:', { userUuid, limit, offset });
      
      const result = await this.db
        .select()
        .from(orders)
        .where(eq(orders.user_uuid, userUuid))
        .orderBy(desc(orders.created_at))
        .limit(limit)
        .offset(offset);

      console.log('[DEBUG] getUserOrders result:', { resultLength: result.length, limit, offset });
      return result as Order[];
    } catch (error) {
      console.error('Get user orders error:', error);
      throw new Error(`Failed to get user orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user's order count
  async getUserOrderCount(userUuid: string): Promise<number> {
    try {
      const result = await this.db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.user_uuid, userUuid));

      return result[0]?.count || 0;
    } catch (error) {
      console.error('Get user order count error:', error);
      throw new Error(`Failed to get user order count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get user's order summary
  async getUserOrderSummary(userUuid: string): Promise<OrderSummary> {
    try {
      const allOrders = await this.db
        .select()
        .from(orders)
        .where(eq(orders.user_uuid, userUuid));

      const summary: OrderSummary = {
        total_orders: allOrders.length,
        total_amount: allOrders.reduce((sum, order) => sum + order.amount, 0),
        total_credits: allOrders.reduce((sum, order) => sum + order.credits, 0),
        completed_orders: allOrders.filter(order => order.status === 'completed' || order.status === 'paid').length,
        pending_orders: allOrders.filter(order => order.status === 'pending').length,
        cancelled_orders: allOrders.filter(order => order.status === 'cancelled').length,
      };

      return summary;
    } catch (error) {
      console.error('Get user order summary error:', error);
      throw new Error(`Failed to get user order summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get order by order number
  async getOrderByOrderNo(orderNo: string): Promise<Order | null> {
    try {
      const result = await this.db
        .select()
        .from(orders)
        .where(eq(orders.order_no, orderNo))
        .limit(1);

      return (result[0] as Order) || null;
    } catch (error) {
      console.error('Get order by order number error:', error);
      throw new Error(`Failed to get order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get orders by status
  async getUserOrdersByStatus(userUuid: string, status: string, limit: number = 20, offset: number = 0): Promise<Order[]> {
    try {
      const result = await this.db
        .select()
        .from(orders)
        .where(and(eq(orders.user_uuid, userUuid), eq(orders.status, status)))
        .orderBy(desc(orders.created_at))
        .limit(limit)
        .offset(offset);

      return result as Order[];
    } catch (error) {
      console.error('Get user orders by status error:', error);
      throw new Error(`Failed to get user orders by status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced method: Get user's orders including those that may have empty user_uuid but matching email
  async getUserOrdersWithEmailFallback(userUuid: string, userEmail: string, limit: number = 20, offset: number = 0): Promise<Order[]> {
    try {
      console.log('[DEBUG] getUserOrdersWithEmailFallback called:', { userUuid, userEmail, limit, offset });
      
      const result = await this.db
        .select()
        .from(orders)
        .where(
          or(
            eq(orders.user_uuid, userUuid),
            and(
              or(eq(orders.user_uuid, ''), eq(orders.user_uuid, null as any)),
              eq(orders.user_email, userEmail)
            )
          )
        )
        .orderBy(desc(orders.created_at))
        .limit(limit)
        .offset(offset);

      console.log('[DEBUG] getUserOrdersWithEmailFallback result:', { resultLength: result.length, limit, offset });
      return result as Order[];
    } catch (error) {
      console.error('Get user orders with email fallback error:', error);
      throw new Error(`Failed to get user orders with email fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced method: Get user's order count including email fallback
  async getUserOrderCountWithEmailFallback(userUuid: string, userEmail: string): Promise<number> {
    try {
      console.log('[DEBUG] getUserOrderCountWithEmailFallback called:', { userUuid, userEmail });
      
      const result = await this.db
        .select({ count: count() })
        .from(orders)
        .where(
          or(
            eq(orders.user_uuid, userUuid),
            and(
              or(eq(orders.user_uuid, ''), eq(orders.user_uuid, null as any)),
              eq(orders.user_email, userEmail)
            )
          )
        );

      const totalCount = result[0]?.count || 0;
      console.log('[DEBUG] getUserOrderCountWithEmailFallback result:', { totalCount });
      return totalCount;
    } catch (error) {
      console.error('Get user order count with email fallback error:', error);
      throw new Error(`Failed to get user order count with email fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Enhanced method: Get user's order summary including email fallback
  async getUserOrderSummaryWithEmailFallback(userUuid: string, userEmail: string): Promise<OrderSummary> {
    try {
      console.log('[DEBUG] getUserOrderSummaryWithEmailFallback called:', { userUuid, userEmail });
      
      const allOrders = await this.db
        .select()
        .from(orders)
        .where(
          or(
            eq(orders.user_uuid, userUuid),
            and(
              or(eq(orders.user_uuid, ''), eq(orders.user_uuid, null as any)),
              eq(orders.user_email, userEmail)
            )
          )
        );

      const summary: OrderSummary = {
        total_orders: allOrders.length,
        total_amount: allOrders.reduce((sum, order) => sum + order.amount, 0),
        total_credits: allOrders.reduce((sum, order) => sum + order.credits, 0),
        completed_orders: allOrders.filter(order => order.status === 'completed' || order.status === 'paid').length,
        pending_orders: allOrders.filter(order => order.status === 'pending').length,
        cancelled_orders: allOrders.filter(order => order.status === 'cancelled').length,
      };

      console.log('[DEBUG] getUserOrderSummaryWithEmailFallback result:', summary);
      return summary;
    } catch (error) {
      console.error('Get user order summary with email fallback error:', error);
      throw new Error(`Failed to get user order summary with email fallback: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
