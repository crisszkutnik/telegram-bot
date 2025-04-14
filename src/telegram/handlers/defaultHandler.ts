import type { ActiveChatInfo } from "../messageHandlerService";
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
    _ctx: TextMessageContext,
    _chatInfo: Map<number, ActiveChatInfo>,
  ): Promise<string> {
    return "Hola!";
  }
}
