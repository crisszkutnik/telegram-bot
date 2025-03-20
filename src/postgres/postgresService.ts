import postgres from "postgres";
import { DB_MAX_CONNECTIONS, DB_URL } from "../config";
import { createLogger } from "../utils";
import { QueryError } from "../exceptions";

interface Notification {
  user_id: string;
  telegram_message_id: number;
  app: string;
  vendor: string;
  payment_method: string;
  amount: number;
}

export class PostgresService {
  private readonly logger = createLogger(PostgresService.name);
  private readonly sql;

  constructor() {
    this.sql = postgres(DB_URL, {
      max: DB_MAX_CONNECTIONS,
    });
  }

  async getUserFromTelegramUserId(telegramUserId: number): Promise<string> {
    const ret = await this
      .sql`SELECT user_id FROM public.telegram_user_info WHERE telegram_user_id = ${telegramUserId} LIMIT 1`;

    const row = ret[0] as { user_id: string } | undefined;

    if (row === undefined) {
      const msg = `Could not find user_id for telegram_user_id ${telegramUserId}`;
      this.logger.error(msg);
      throw new QueryError(msg);
    }

    return row?.user_id;
  }

  async getTelegramUserIdFromUserId(userId: string): Promise<string> {
    const ret = await this
      .sql`SELECT telegram_user_id FROM public.telegram_user_info WHERE user_id = ${userId} LIMIT 1`;

    const row = ret[0] as { telegram_user_id: string } | undefined;

    if (row === undefined) {
      const msg = `Could not find telegram_user_id for user_id ${userId}`;
      this.logger.error(msg);
      throw new QueryError(msg);
    }

    return row?.telegram_user_id;
  }

  async getNotification(userId: string, telegramMessageId: number) {
    const ret = await this.sql`
      SELECT user_id, telegram_message_id, app, vendor, payment_method, amount
      FROM public.notifications
      WHERE user_id = ${userId} AND telegram_message_id = ${telegramMessageId}
      LIMIT 1
    `;

    const row = ret[0] as Notification | undefined;

    if (row === undefined) {
      const msg = `Could not find notifiaction with the following information (user_id, telegram_message_id) = (${userId}, ${telegramMessageId})`;
      this.logger.error(msg);
      throw new QueryError(msg);
    }

    return row;
  }

  async insertNotification(notification: Notification) {
    await this.sql`INSERT INTO public.notifications ${this.sql(
      notification,
      "user_id",
      "amount",
      "app",
      "payment_method",
      "telegram_message_id",
      "vendor"
    )}`;
  }
}
