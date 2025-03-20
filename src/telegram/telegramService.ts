import { Telegraf } from "telegraf";
import { TELEGRAM_BOT_TOKEN } from "../config";
import type { GrpcService } from "../grpcService";
import type {
  MessageHandler,
  TextMessageContext,
} from "./handlers/messageHandler.interface";
import { CancelHandler } from "./handlers/cancelHandler";
import { GastoHandler } from "./handlers/gastoHandler";
import { DefaultHandler } from "./handlers/defaultHandler";
import { createLogger, escapeMarkdownMessage } from "../utils";
import { randomUUID } from "node:crypto";
import { UserError } from "../exceptions";
import { PostgresService } from "../postgres/postgresService";
import { AutomatedExpenseHandler } from "./handlers/automatedExpenseHandler";

export enum ChatStatus {
  SPENDING = "SPENDING",
}

export interface ActiveChatInfo<T = unknown> {
  status: ChatStatus;
  createdAt: number;
  lastMessageAt: number;
  data: T;
}

type ChatId = number;
const chatStatus = new Map<ChatId, ActiveChatInfo>();

export class TelegramService {
  readonly bot: Telegraf;
  readonly handlers: MessageHandler[];
  readonly chatStatus = new Map<ChatId, ActiveChatInfo>();
  private readonly logger = createLogger(TelegramService.name);

  constructor(
    private readonly grpcService: GrpcService,
    private readonly postgresService: PostgresService
  ) {
    this.bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    this.handlers = [
      new CancelHandler(),
      new GastoHandler(this.grpcService),
      new AutomatedExpenseHandler(this.postgresService),
      new DefaultHandler(),
    ];

    this.bot.on("message", async (ctx) => {
      if (!("message" in ctx) || !("text" in ctx.message)) {
        return;
      }

      const coercedContext = ctx as TextMessageContext;
      coercedContext.correlationId = randomUUID();

      coercedContext.message.reply_to_message;

      this.logger.info("Message received", {
        messageContent: coercedContext.message.text,
        chatId: coercedContext.message.chat.id,
        correlationId: coercedContext.correlationId,
      });

      this.handleMessage(coercedContext);
    });
  }

  async launch() {
    this.logger.info("Launching bot");
    await this.bot.launch();
  }

  async handleMessage(ctx: TextMessageContext) {
    for (const handler of this.handlers) {
      if (handler.shouldHandle(ctx, chatStatus)) {
        try {
          this.logger.info(
            `Message will be handled by ${handler.constructor.name}`,
            { correlationId: ctx.correlationId }
          );
          await handler.handle(ctx, chatStatus);
        } catch (e: unknown) {
          await this.handleError(ctx, e as Error);
        }

        break;
      }
    }
  }

  async handleError(ctx: TextMessageContext, e: Error) {
    if (e instanceof UserError) {
      await ctx.telegram.sendMessage(ctx.message.chat.id, e.message);
      return;
    }

    await ctx.telegram.sendMessage(
      ctx.message.chat.id,
      "Ocurrio un error. Por favor vuelve a intentar"
    );
    chatStatus.delete(ctx.message.chat.id);

    this.logger.error({
      message: e,
      correlationId: ctx.correlationId,
      originalMessage: ctx.message.text,
    });
  }

  async sendMessage(chatId: string | number, msg: string) {
    return await this.bot.telegram.sendMessage(
      chatId,
      escapeMarkdownMessage(msg),
      {
        parse_mode: "MarkdownV2",
      }
    );
  }
}
