import postgres from "postgres";
import { DB_MAX_CONNECTIONS, DB_URL } from "../config";
import { createLogger } from "../utils";

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
    this.logger.info("Starting service");
    this.sql = postgres(DB_URL, {
      max: DB_MAX_CONNECTIONS,
    });
  }

  async getUserFromTelegramUserId(
    telegramUserId: number
  ): Promise<string | undefined> {
    const ret = await this
      .sql`SELECT user_id FROM public.telegram_user_info WHERE telegram_user_id = ${telegramUserId} LIMIT 1`;

    const row = ret[0] as { user_id: string } | undefined;
    return row?.user_id;
  }

  async getTelegramUserIdFromUserId(
    userId: string
  ): Promise<string | undefined> {
    const ret = await this
      .sql`SELECT telegram_user_id FROM public.telegram_user_info WHERE user_id = ${userId} LIMIT 1`;

    const row = ret[0] as { telegram_user_id: string } | undefined;
    return row?.telegram_user_id;
  }

  async getNotification(
    userId: string,
    telegramMessageId: number
  ): Promise<Notification | undefined> {
    const ret = await this.sql`
      SELECT user_id, telegram_message_id, app, vendor, payment_method, amount
      FROM public.notifications
      WHERE user_id = ${userId} AND telegram_message_id = ${telegramMessageId}
      LIMIT 1
    `;

    const row = ret[0] as Notification | undefined;
    return row;
  }

  async insertNotification(notification: Notification): Promise<void> {
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
