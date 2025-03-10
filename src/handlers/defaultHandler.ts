import type { ActiveChatInfo } from "../telegramService";
import type {
  MessageHandler,
  TextMessageContext,
} from "./messageHandler.interface";

export class DefaultHandler implements MessageHandler {
  shouldHandle(
    _ctx: TextMessageContext,
    _chatInfo: Map<number, ActiveChatInfo>,
  ): boolean {
    return true;
  }

  async handle(
    ctx: TextMessageContext,
    _chatInfo: Map<number, ActiveChatInfo>,
  ): Promise<void> {
    await ctx.telegram.sendMessage(ctx.message.chat.id, "HOLA!");
  }
}
