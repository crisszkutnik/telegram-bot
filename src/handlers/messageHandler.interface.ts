import type { Context, NarrowedContext } from "telegraf";
import type { Message, Update } from "telegraf/typings/core/types/typegram";
import type { ActiveChatInfo } from "../telegramService";

export type TextMessageContext = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Message.TextMessage>
> & { correlationId: string };

export interface MessageHandler {
  shouldHandle(
    ctx: TextMessageContext,
    chatInfo: Map<number, ActiveChatInfo>,
  ): boolean;
  handle(
    ctx: TextMessageContext,
    chatInfo: Map<number, ActiveChatInfo>,
  ): Promise<void>;
}
