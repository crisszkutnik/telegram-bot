import { Telegraf } from "telegraf";
import { TELEGRAM_BOT_TOKEN } from "../config";
import type { GrpcService } from "../grpcService";
import type {
  ResponseOptions,
  TextMessageContext,
} from "./handlers/messageHandler.interface";
import { CancelHandler } from "./handlers/cancelHandler";
import { GastoHandler } from "./handlers/gastoHandler";
import { DefaultHandler } from "./handlers/defaultHandler";
import { createLogger, escapeMarkdownMessage } from "../utils";
import { randomUUID } from "node:crypto";
import type { PostgresService } from "../postgres/postgresService";
import { AutomatedExpenseHandler } from "./handlers/automatedExpenseHandler";
import { MessageHandlerService } from "./messageHandlerService";
import type { ExtraReplyMessage } from "telegraf/typings/telegram-types";

export class TelegramService {
  readonly bot: Telegraf;
  private readonly logger = createLogger(TelegramService.name);
  private readonly messageHandlerService;

  constructor(
    private readonly grpcService: GrpcService,
    private readonly postgresService: PostgresService
  ) {
    this.bot = new Telegraf(TELEGRAM_BOT_TOKEN);

    this.messageHandlerService = new MessageHandlerService(this, [
      new CancelHandler(),
      new GastoHandler(this.grpcService, this.postgresService),
      new AutomatedExpenseHandler(this.grpcService, this.postgresService),
      new DefaultHandler(),
    ]);

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

      this.messageHandlerService.handleMessage(coercedContext);
    });
  }

  async launch() {
    this.logger.info("Launching bot");
    await this.bot.launch();
  }

  async sendMessage(
    chatId: string | number,
    msg: string,
    options?: ResponseOptions
  ) {
    const finalMsg = options?.isMarkdown ? escapeMarkdownMessage(msg) : msg;

    const opts: ExtraReplyMessage = {};

    if (options?.isMarkdown) {
      opts.parse_mode = "MarkdownV2";
    }

    if (options?.replyToMessage !== undefined) {
      opts.reply_parameters = {
        message_id: options.replyToMessage,
      };
    }

    return await this.bot.telegram.sendMessage(chatId, finalMsg, opts);
  }
}
