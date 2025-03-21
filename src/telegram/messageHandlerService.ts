import { UserError } from "../exceptions";
import { createLogger } from "../utils";
import type {
  AdvancedResponse,
  MessageHandler,
  TextMessageContext,
} from "./handlers/messageHandler.interface";
import type { TelegramService } from "./telegramService";

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

export class MessageHandlerService {
  private readonly logger = createLogger(MessageHandlerService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly handlers: MessageHandler[]
  ) {}

  async handleMessage(ctx: TextMessageContext) {
    const handler = this.handlers.find((h) => h.shouldHandle(ctx, chatStatus));

    if (!handler) {
      return;
    }

    this.logger.info(`Message will be handled by ${handler.constructor.name}`, {
      correlationId: ctx.correlationId,
    });

    try {
      const response = await handler.handle(ctx, chatStatus);

      const chatId = ctx.message.chat.id;

      const isAdvancedResponse = typeof response !== "string";

      const message = isAdvancedResponse ? response.message : response;
      const options = isAdvancedResponse ? response.options || {} : {};

      await this.telegramService.sendMessage(chatId, message, options);

      if (isAdvancedResponse) {
        await this.runPostMessageHandler(ctx, response);
      }
    } catch (e: unknown) {
      await this.handleError(ctx, e as Error);
    }
  }

  private async runPostMessageHandler(
    ctx: TextMessageContext,
    response: AdvancedResponse
  ) {
    try {
      if (response.postMessageHandle) {
        await response.postMessageHandle();
      }
    } catch (e: unknown) {
      this.logger.error({
        message: e,
        correlationId: ctx.correlationId,
        originalMessage: ctx.message.text,
      });
    }
  }

  private async handleError(ctx: TextMessageContext, e: Error) {
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
}
