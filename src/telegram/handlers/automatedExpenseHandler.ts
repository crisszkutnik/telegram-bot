import type { Message } from "telegraf/typings/core/types/typegram";
import type {
  AdvancedResponse,
  MessageHandler,
  TextMessageContext,
} from "./messageHandler.interface";
import { repliedMessageSenderIsBot } from "../../ctxHelpers";
import type {
  Notification,
  PostgresService,
} from "../../postgres/postgresService";
import type { NewExpenseRequest } from "../../proto/proto/NewExpenseRequest";
import { createLogger, formatDate, isValidDate, parseDate } from "../../utils";
import type { GrpcService } from "../../grpcService";
import { UserError } from "../../exceptions";
import type { ActiveChatInfo } from "../messageHandlerService";

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
  private readonly logger = createLogger(AutomatedExpenseHandler.name);

  constructor(
    private readonly grpcService: GrpcService,
    private readonly postgresService: PostgresService
  ) {}

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
  ): Promise<AdvancedResponse> {
    const oldMessage = ctx.message.reply_to_message as Message.TextMessage;

    const oldMessageId = oldMessage.message_id;
    const telegramUserId = ctx.message.from.id;

    const userId = await this.postgresService.getUserFromTelegramUserId(
      telegramUserId
    );

    if (userId === undefined) {
      this.logger.error(
        `Failed to find userId for related telegramUserId ${userId}`
      );
      throw new Error();
    }

    const notification = await this.postgresService.getNotification(
      userId,
      oldMessageId
    );

    if (notification === undefined) {
      this.logger.error(
        `Failed to find related notification for (userId, telegramMessageId) = (${userId}, ${telegramUserId})`
      );
      throw new Error();
    }

    const newExpense = this.processMessageText(ctx.message.text, notification);

    await this.grpcService.addExpense(newExpense);

    const message = `Se guardo exitosamente el siguiente gasto:
          
          - *__Nombre:__* ${newExpense.name}
          - *__Metodo de pago:__* ${newExpense.paymentMethod}
          - *__Moneda:__* ${newExpense.currency}
          - *__Monto:__* ${newExpense.amount}
          - *__Categoria:__* ${newExpense.category}
          - *__Subcategoria:__* ${newExpense.subcategory || ""}
          - *__Fecha:__* ${newExpense.date}
          `;

    return {
      message: message,
      options: {
        isMarkdown: true,
        replyToMessage: ctx.message.message_id,
      },
      postMessageHandle: async () => {
        await this.postgresService.deleteNotification(
          notification.user_id,
          notification.telegram_message_id
        );
      },
    };
  }

  private processMessageText(msgText: string, notification: Notification) {
    const parts = msgText.split("\n");

    const category = parts[0];

    const hasSubcategory = parts[1] !== "";
    const subcategory = hasSubcategory ? parts[1] : "";

    const firstOverrideIdx = hasSubcategory ? 3 : 2;

    const overrideFields = this.getOverrideFields(firstOverrideIdx, parts);

    const formattedDate = this.getFormattedDate(
      overrideFields["Fecha"],
      notification.timestamp
    );

    return {
      name: overrideFields["Nombre"] || notification.vendor,
      paymentMethod:
        overrideFields["Metodo de pago"] || notification.payment_method,
      currency: overrideFields["Moneda"] || "ARS",
      amount: Number(overrideFields["Monto"]) || notification.amount,
      category: category,
      subcategory: subcategory,
      date: formattedDate,
    } as NewExpenseRequest;
  }

  private getFormattedDate(
    overridedDate: string | undefined,
    notificationTimestamp: Date
  ) {
    const date =
      overridedDate !== undefined && overridedDate !== ""
        ? parseDate(overridedDate)
        : notificationTimestamp;

    if (!isValidDate(date)) {
      throw new UserError(`La fecha '${date}' no es una fecha valida`);
    }

    return formatDate(date);
  }

  private getOverrideFields(firstOverrideIdx: number, parts: string[]) {
    const overrideFields: Record<string, string> = {};

    for (let i = firstOverrideIdx; i < parts.length; i++) {
      if (parts[i] === undefined) {
        break;
      }

      const [fieldName, fieldValueFull] = parts[i].split(":");

      const fieldValue = fieldValueFull.trim();

      overrideFields[fieldName] = fieldValue;
    }

    return overrideFields;
  }
}
