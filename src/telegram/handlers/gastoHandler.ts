import { UserError } from "../../exceptions";
import type { GrpcService } from "../../grpcService";
import type { PostgresService } from "../../postgres/postgresService";
import type { ExpenseInfo } from "../../proto/proto/ExpenseInfo";
import type { NewExpenseRequest } from "../../proto/proto/NewExpenseRequest";
import {
  countCharacter,
  formatDate,
  isValidDate,
  parseDate,
} from "../../utils";
import type { ActiveChatInfo } from "../messageHandlerService";
import type {
  AdvancedResponse,
  MessageHandler,
  TextMessageContext,
} from "./messageHandler.interface";

/*
Paddle
Efectivo
ARS
6250
Deporte
Hoy

Paddle
Efectivo
6250
Deporte
Hoy

---

Paddle
Efectivo
ARS
6250
Deporte
Paddle
Hoy

Paddle
Efectivo
6250
Deporte
Paddle
Hoy
*/

type SingleMessageTypes =
  | [string, string, string, string]
  | [string, string, string, string, string]
  | [string, string, string, string, string, string];

export class GastoHandler implements MessageHandler {
  constructor(
    private readonly grpcService: GrpcService,
    private readonly postgresService: PostgresService,
  ) {}

  shouldHandle(
    ctx: TextMessageContext,
    _chatInfo: Map<number, ActiveChatInfo>,
  ): boolean {
    if (ctx.message.reply_to_message) {
      return false;
    }

    const text = ctx.message.text;
    const newLines = countCharacter(text, "\n");

    return newLines === 4 || newLines === 5 || newLines === 6;
  }

  async handle(
    ctx: TextMessageContext,
    _chatInfo: Map<number, ActiveChatInfo>,
  ): Promise<AdvancedResponse> {
    const lines = ctx.message.text.split("\n");

    return await this.handleSingleMessage(ctx, lines as SingleMessageTypes);
  }

  async handleSingleMessage(
    ctx: TextMessageContext,
    lines: SingleMessageTypes,
  ): Promise<AdvancedResponse> {
    const expenseInfo = this.getExpenseInfo(lines);

    const telegramUserId = ctx.message.from.id;
    const userId =
      await this.postgresService.getUserFromTelegramUserId(telegramUserId);

    if (userId === undefined) {
      throw new Error(
        `Failed to find userId for related telegramUserId ${userId}`,
      );
    }

    const expenseRequest = {
      userId,
      expenseInfo,
    } as NewExpenseRequest;

    await this.grpcService.addExpense(expenseRequest);

    const message = `Se registro exitosamente el siguiente gasto
      
      - *__Nombre:__* ${expenseInfo.name}
      - *__Metodo de pago:__* ${expenseInfo.paymentMethod}
      - *__Moneda:__* ${expenseInfo.currency}
      - *__Monto:__* ${expenseInfo.amount}
      - *__Categoria:__* ${expenseInfo.category}
      - *__Subcategoria:__* ${expenseInfo.subcategory || ""}
      - *__Fecha:__* ${expenseInfo.date}
      `;

    return {
      message,
      options: {
        isMarkdown: true,
        replyToMessage: ctx.message.message_id,
      },
    };
  }

  private getExpenseInfo(lines: SingleMessageTypes): ExpenseInfo {
    const name = lines[0];
    const paymentMethod = lines[1];

    const amountIdx = lines.findIndex((l) => !Number.isNaN(Number(l)));

    if (amountIdx === -1 || (amountIdx !== 2 && amountIdx !== 3)) {
      throw new UserError(
        "Error al leer el monto de tu mensaje. Recuerda escribirlo en el formato correcto",
      );
    }

    const amount = Number(lines[amountIdx]);

    const currency = amountIdx === 3 ? lines[2].toUpperCase() : "ARS";

    const category = lines[amountIdx + 1];

    const dateIdx = lines.length - 1;
    const dateStr = lines[lines.length - 1];
    const date = parseDate(dateStr);

    if (!isValidDate(date)) {
      throw new UserError(`La fecha ${dateStr} no es una fecha valida`);
    }

    const subcategory = this.getSubcategory(lines, amountIdx, dateIdx);

    const formattedDate = formatDate(date);

    return {
      name,
      paymentMethod,
      amount,
      currency,
      category,
      subcategory,
      date: formattedDate,
    } as ExpenseInfo;
  }

  private getSubcategory(
    lines: SingleMessageTypes,
    amountIdx: number,
    dateIdx: number,
  ) {
    if (amountIdx + 3 === dateIdx) {
      return lines[dateIdx - 1];
    }

    return undefined;
  }
}
