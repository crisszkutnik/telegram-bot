import type { ActiveChatInfo } from "../telegramService";
import type {
  MessageHandler,
  TextMessageContext,
} from "./messageHandler.interface";

export class CancelHandler implements MessageHandler {
  shouldHandle(
    ctx: TextMessageContext,
    _chatInfo: Map<number, ActiveChatInfo>,
  ): boolean {
    return ctx.message.text.toLowerCase() === "cancelar";
  }

  async handle(
    ctx: TextMessageContext,
    chatInfo: Map<number, ActiveChatInfo>,
  ): Promise<void> {
    chatInfo.delete(ctx.message.chat.id);
    await ctx.telegram.sendMessage(
      ctx.message.chat.id,
      "Cancelado exitosamente",
    );
  }
}
