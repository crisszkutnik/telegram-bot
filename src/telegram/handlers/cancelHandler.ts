import type { ActiveChatInfo } from "../messageHandlerService";
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
  ): Promise<string> {
    chatInfo.delete(ctx.message.chat.id);

    return "Cancelado exitosamente";
  }
}
