import { UserError } from "../../exceptions";
import type { GrpcService } from "../../grpcService";
import type { NewExpenseRequest } from "../../proto/proto/NewExpenseRequest";
import { ChatStatus, type ActiveChatInfo } from "../telegramService";
import {
  countCharacter,
  escapeMarkdownMessage,
  formatDate,
  isValidDate,
  parseDate,
} from "../../utils";
import type {
  MessageHandler,
  TextMessageContext,
} from "./messageHandler.interface";

// This is telling you which should be the input of the next message received
enum SpendingChatSteps {
  INITIAL = "initial",
  NAME = "name",
  AMOUNT = "amount",
  CATEGORY = "category",
  SUBCATEGORY = "subcategory",
  DATE = "date",
}

interface SpendingChatInfo {
  step: SpendingChatSteps;
}

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
    chatInfo: Map<number, ActiveChatInfo>
  ): boolean {
    const text = ctx.message.text;
    const chatId = ctx.message.chat.id;

    if (ctx.message.reply_to_message) {
      return false;
    }

    const newLines = countCharacter(text, "\n");

    return (
      text === "gasto" ||
      newLines === 4 ||
      newLines === 5 ||
      newLines === 6 ||
      chatInfo.get(chatId)?.status === ChatStatus.SPENDING
    );
  }

  async handle(ctx: TextMessageContext, chatInfo: Map<number, ActiveChatInfo>) {
    const lines = ctx.message.text.split("\n");

    if (lines.length === 1) {
      await this.handleSteps(ctx, chatInfo);
    }

    const info = chatInfo.get(ctx.message.chat.id) as
      | ActiveChatInfo<SpendingChatInfo>
      | undefined;

    if (info !== undefined) {
      throw new UserError(
        `⚠️Notamos que estabas realizando otra operacion.⚠️
        
        Para continuar con esta operacion escribe 'CANCELAR' para cancelar la operacion anterior y vuelve a intentar.`
      );
    }

    await this.handleSingleMessage(ctx, lines as SingleMessageTypes);
  }

  async handleSingleMessage(
    ctx: TextMessageContext,
    lines: SingleMessageTypes
  ) {
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

    await ctx.telegram.sendMessage(
      ctx.message.chat.id,
      escapeMarkdownMessage(
        `Se registro exitosamente el siguiente gasto
      
      - *__Nombre:__* ${name}
      - *__Metodo de pago:__* ${paymentMethod}
      - *__Moneda:__* ${currency}
      - *__Monto:__* ${amount}
      - *__Categoria:__* ${category}
      - *__Subcategoria:__* ${subcategory || ""}
      - *__Fecha:__* ${formattedDate}
      `
      ),
      { parse_mode: "MarkdownV2" }
    );
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

  async handleSteps(
    ctx: TextMessageContext,
    chatInfo: Map<number, ActiveChatInfo>
  ) {
    let info = chatInfo.get(ctx.message.chat.id) as
      | ActiveChatInfo<SpendingChatInfo>
      | undefined;

    const chatId = ctx.message.chat.id;

    if (info === undefined) {
      const obj = {
        status: ChatStatus.SPENDING,
        createdAt: Date.now(),
        lastMessageAt: ctx.message.date,
        data: {
          step: SpendingChatSteps.INITIAL,
        },
      } as ActiveChatInfo<SpendingChatInfo>;
      chatInfo.set(chatId, obj);
      info = obj;
    }

    info.lastMessageAt = ctx.message.date;

    if (info?.status !== ChatStatus.SPENDING) {
      // fatal error
    }

    switch (info?.data.step) {
      case SpendingChatSteps.INITIAL:
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Introduci el nombre del gasto"
        );
        info.data.step = SpendingChatSteps.NAME;
        break;

      case SpendingChatSteps.NAME:
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Introduci el monto del gasto. Si queres especificar la moneda tambien podes poniendo el codigo antes del gasto. Por ej: 'USD 150'"
        );
        info.data.step = SpendingChatSteps.AMOUNT;
        break;

      case SpendingChatSteps.AMOUNT:
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Introduci la categoria del gasto"
        );
        info.data.step = SpendingChatSteps.CATEGORY;
        break;

      case SpendingChatSteps.CATEGORY:
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Introduci la subcategoria"
        );
        info.data.step = SpendingChatSteps.SUBCATEGORY;
        break;

      case SpendingChatSteps.SUBCATEGORY:
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Introduci la fecha del gasto"
        );
        info.data.step = SpendingChatSteps.DATE;
        break;

      case SpendingChatSteps.DATE:
        await ctx.telegram.sendMessage(
          ctx.message.chat.id,
          "Gracias! Gasto registrado"
        );
        chatInfo.delete(ctx.message.chat.id);
        break;
    }
  }
}
