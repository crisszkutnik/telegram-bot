import type { Context, NarrowedContext } from "telegraf";
import type { Message, Update } from "telegraf/typings/core/types/typegram";
import type { ActiveChatInfo } from "../messageHandlerService";

export type TextMessageContext = NarrowedContext<
  Context<Update>,
  Update.MessageUpdate<Message.TextMessage>
> & { correlationId: string };

export interface ResponseOptions {
  isMarkdown?: boolean;
  replyToMessage?: number;
}

export interface AdvancedResponse {
  message: string;
  options?: ResponseOptions;
  postMessageHandle?: (() => void) | (() => Promise<void>);
}

export interface MessageHandler {
  shouldHandle(
    ctx: TextMessageContext,
    chatInfo: Map<number, ActiveChatInfo>
  ): boolean;
  handle(
    ctx: TextMessageContext,
    chatInfo: Map<number, ActiveChatInfo>
  ): Promise<AdvancedResponse | string>;
}
