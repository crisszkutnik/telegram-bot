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
import { formatDate, isValidDate, parseDate } from "../../utils";
import type { GrpcService } from "../../grpcService";
import { UserError } from "../../exceptions";
import type { ActiveChatInfo } from "../messageHandlerService";
import type { ExpenseInfo } from "../../proto/proto/ExpenseInfo";

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
  constructor(
    private readonly grpcService: GrpcService,
    private readonly postgresService: PostgresService,
  ) {}

  shouldHandle(
    ctx: TextMessageContext,
    _: Map<number, ActiveChatInfo>,
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
        "Detectamos el siguiente gasto en la aplicacion",
      )
    );
  }

  async handle(
    ctx: TextMessageContext,
    _: Map<number, ActiveChatInfo>,
  ): Promise<AdvancedResponse> {
    const oldMessage = ctx.message.reply_to_message as Message.TextMessage;

    const oldMessageId = oldMessage.message_id;
    const telegramUserId = ctx.message.from.id;

    const userId =
      await this.postgresService.getUserFromTelegramUserId(telegramUserId);

    if (userId === undefined) {
      throw new Error(
        `Failed to find userId for related telegramUserId ${userId}`,
      );
    }

    const notification = await this.postgresService.getNotification(
      userId,
      oldMessageId,
    );

    if (notification === undefined) {
      throw new Error(
        `Failed to find related notification for (userId, telegramMessageId) = (${userId}, ${telegramUserId})`,
      );
    }

    const expenseInfo = this.processMessageText(ctx.message.text, notification);

    const expenseRequest = {
      userId,
      expenseInfo,
    } as NewExpenseRequest;

    await this.grpcService.addExpense(expenseRequest);

    const message = `Se guardo exitosamente el siguiente gasto:
          
          - *__Nombre:__* ${expenseInfo.name}
          - *__Metodo de pago:__* ${expenseInfo.paymentMethodName}
          - *__Moneda:__* ${expenseInfo.currency}
          - *__Monto:__* ${expenseInfo.amount}
          - *__Categoria:__* ${expenseInfo.categoryName}
          - *__Subcategoria:__* ${expenseInfo.subcategoryName || ""}
          - *__Fecha:__* ${expenseInfo.date}
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
          notification.telegram_message_id,
        );
      },
    };
  }

  private processMessageText(
    msgText: string,
    notification: Notification,
  ): ExpenseInfo {
    const parts = msgText.split("\n");

    const category = parts[0];

    const hasSubcategory = parts[1] !== "";
    const subcategory = hasSubcategory ? parts[1] : "";

    const firstOverrideIdx = hasSubcategory ? 3 : 2;

    const overrideFields = this.getOverrideFields(firstOverrideIdx, parts);

    const formattedDate = this.getFormattedDate(
      overrideFields["Fecha"],
      notification.timestamp,
    );

    return {
      name: overrideFields["Nombre"] || notification.vendor,
      paymentMethodName:
        overrideFields["Metodo de pago"] || notification.payment_method,
      currency: overrideFields["Moneda"] || "ARS",
      amount: Number(overrideFields["Monto"]) || notification.amount,
      categoryName: category,
      subcategoryName: subcategory,
      date: formattedDate,
    } as ExpenseInfo;
  }

  private getFormattedDate(
    overridedDate: string | undefined,
    notificationTimestamp: Date,
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
