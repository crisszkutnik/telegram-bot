import type { Message } from "telegraf/typings/core/types/typegram";
import type { ActiveChatInfo } from "../telegramService";
import type {
  MessageHandler,
  TextMessageContext,
} from "./messageHandler.interface";
import { repliedMessageSenderIsBot } from "../../ctxHelpers";
import type { PostgresService } from "../../postgres/postgresService";
import type { NewExpenseRequest } from "../../proto/proto/NewExpenseRequest";
import { escapeMarkdownMessage } from "../../utils";

/*

Detectamos el siguiente gasto en la aplicacion *Banco Galicia*

Nombre: Vendor
Medio de pago: Payment Method
Moneda: Currency
Monto: Amount
Fecha: Date

Valid user inputs:

Category

Category
Subcategory


"""
Category
Subcategory

Modified field: somefield
"""

*/

export class AutomatedExpenseHandler implements MessageHandler {
  constructor(private readonly postgresService: PostgresService) {}

  shouldHandle(
    ctx: TextMessageContext,
    _: Map<number, ActiveChatInfo>
  ): boolean {
    if (
      !ctx.message.reply_to_message ||
      !("text" in ctx.message.reply_to_message)
    ) {
      return false;
    }

    const oldMessage = ctx.message.reply_to_message as Message.TextMessage;

    // Maybe try to validate message with the 'notifications' table
    // since we have the message ID there?

    return (
      !repliedMessageSenderIsBot(ctx) &&
      oldMessage.text !== undefined &&
      oldMessage.text.startsWith(
        "Detectamos el siguiente gasto en la aplicacion"
      )
    );
  }

  async handle(
    ctx: TextMessageContext,
    _: Map<number, ActiveChatInfo>
  ): Promise<void> {
    const oldMessage = ctx.message.reply_to_message as Message.TextMessage;

    // const oldMessageText = oldMessage.text;
    const oldMessageId = oldMessage.message_id;
    const telegramUserId = ctx.message.from.id;

    const userId = await this.postgresService.getUserFromTelegramUserId(
      telegramUserId
    );

    const notification = await this.postgresService.getNotification(
      userId,
      oldMessageId
    );

    const newExpense = {
      name: notification.vendor,
      paymentMethod: notification.payment_method,
      currency: "ARS",
      amount: notification.amount,
      category: "",
      subcategory: "",
      date: "",
    } as NewExpenseRequest;

    // TODO: Actually save expense

    await ctx.telegram.sendMessage(
      ctx.message.chat.id,
      escapeMarkdownMessage(
        `Se guardo exitosamente el siguiente gasto:
          
          - *__Nombre:__* ${newExpense.name}
          - *__Metodo de pago:__* ${newExpense.paymentMethod}
          - *__Moneda:__* ${newExpense.currency}
          - *__Monto:__* ${newExpense.amount}
          - *__Categoria:__* ${newExpense.category}
          - *__Subcategoria:__* ${newExpense.subcategory || ""}
          - *__Fecha:__* ${newExpense.date}
          `
      ),
      {
        parse_mode: "MarkdownV2",
        reply_parameters: {
          message_id: ctx.message.message_id,
        },
      }
    );
  }
}
