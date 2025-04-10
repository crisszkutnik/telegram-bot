import { UserError } from "../../exceptions";
import type { GrpcService } from "../../grpcService";
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
  constructor(private readonly grpcService: GrpcService) {}

  shouldHandle(
    ctx: TextMessageContext,
    _chatInfo: Map<number, ActiveChatInfo>
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
    _chatInfo: Map<number, ActiveChatInfo>
  ): Promise<AdvancedResponse> {
    const lines = ctx.message.text.split("\n");

    return await this.handleSingleMessage(ctx, lines as SingleMessageTypes);
  }

  async handleSingleMessage(
    ctx: TextMessageContext,
    lines: SingleMessageTypes
  ): Promise<AdvancedResponse> {
    const name = lines[0];
    const paymentMethod = lines[1];

    const amountIdx = lines.findIndex((l) => !Number.isNaN(Number(l)));

    if (amountIdx === -1 || (amountIdx !== 2 && amountIdx !== 3)) {
      throw new UserError(
        "Error al leer el monto de tu mensaje. Recuerda escribirlo en el formato correcto"
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
    const allData = {
      name,
      paymentMethod,
      amount,
      currency,
      category,
      subcategory,
      date: formattedDate,
    } as NewExpenseRequest;

    await this.grpcService.addExpense(allData);

    const message = `Se registro exitosamente el siguiente gasto
      
      - *__Nombre:__* ${name}
      - *__Metodo de pago:__* ${paymentMethod}
      - *__Moneda:__* ${currency}
      - *__Monto:__* ${amount}
      - *__Categoria:__* ${category}
      - *__Subcategoria:__* ${subcategory || ""}
      - *__Fecha:__* ${formattedDate}
      `;

    return {
      message,
      options: {
        isMarkdown: true,
        replyToMessage: ctx.message.message_id,
      },
    };
  }

  private getSubcategory(
    lines: SingleMessageTypes,
    amountIdx: number,
    dateIdx: number
  ) {
    if (amountIdx + 3 === dateIdx) {
      return lines[dateIdx - 1];
    }

    return undefined;
  }
}
