import type { TextMessageContext } from "./telegram/handlers/messageHandler.interface";

export function repliedMessageSenderIsBot(ctx: TextMessageContext): boolean {
  if (
    !ctx.message.reply_to_message ||
    !("message" in ctx.message.reply_to_message)
  ) {
    return false;
  }

  return ctx.message.reply_to_message.from?.id === ctx.botInfo.id;
}
