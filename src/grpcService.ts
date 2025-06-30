import { credentials, loadPackageDefinition } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { EXPENSES_API_URL, GRPC_WAIT_FOR_READY_TIMEOUT } from "./config";
import type { ProtoGrpcType } from "./proto/Expense";
import type { ExpensesClient } from "./proto/proto/Expenses";
import type { NewExpenseRequest } from "./proto/proto/NewExpenseRequest";
import type { ExpenseReply } from "./proto/proto/ExpenseReply";
import { createLogger } from "./utils";
import type { ExpenseInfo } from "./proto/proto/ExpenseInfo";

const PROTO_PATH = "./proto/Expense.proto";

// Using 0 as success code was a questionable choice tbh
// TODO: Investigate into using GRPC enums
export enum ResponseCode {
  Success = 0,
  InternalError = 1,
  InvalidPayload = 2,
  InvalidPaymentMethod = 3,
  InvalidCategory = 4,
  InvalidSubcategory = 5,
  InvalidDate = 6,
  InvalidCurrency = 7,
}

export class GrpcError extends Error {
  constructor(
    message: string,
    public readonly code: ResponseCode,
    public readonly expenseRequest: NewExpenseRequest,
  ) {
    super(message);
    this.name = "GrpcError";
  }

  getUserMessage(): string {
    switch (this.code) {
      case ResponseCode.InvalidPaymentMethod:
        return `El metodo de pago ${this.expenseRequest.expenseInfo?.paymentMethodName} no existe. Por favor, elige un metodo de pago existente`;
      case ResponseCode.InvalidCategory:
        return `La categoria ${this.expenseRequest.expenseInfo?.categoryName} no existe. Por favor, elige una categoria existente`;
      case ResponseCode.InvalidSubcategory:
        return `La subcategoria ${this.expenseRequest.expenseInfo?.subcategoryName} no existe. Por favor, elige una subcategoria existente`;
      case ResponseCode.InvalidDate:
        return `Error al procesar la fecha ${this.expenseRequest.expenseInfo?.date} de tu mensaje. Recuerda escribirla en el formato correcto: DD/MM/YYYY u atajos como "hoy" o "ayer"`;
      case ResponseCode.InvalidCurrency:
        return `La moneda ${this.expenseRequest.expenseInfo?.currency} no es valida. Por favor, elige una moneda valida (ARS o USD)`;
      default:
        return "Ocurrio un error. Por favor vuelve a intentar";
    }
  }

  static fromResponse(
    response: ExpenseReply,
    expenseRequest: NewExpenseRequest,
  ): GrpcError {
    return new GrpcError(
      response.message || "Incomplete error",
      response.code || ResponseCode.InternalError,
      expenseRequest,
    );
  }
}

export class GrpcService {
  private readonly logger = createLogger(GrpcService.name);
  client: ExpensesClient;
  constructor() {
    const packageDefinition = loadSync(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = loadPackageDefinition(
      packageDefinition,
    ) as unknown as ProtoGrpcType;

    this.client = new protoDescriptor.proto.Expenses(
      EXPENSES_API_URL,
      credentials.createInsecure(),
    );
  }

  init(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.logger.info("Waiting for GRPC client to be ready");
      this.client.waitForReady(
        Date.now() + GRPC_WAIT_FOR_READY_TIMEOUT,
        (err) => {
          if (!err) {
            this.logger.info("GRPC client is ready");
            resolve();
            return;
          }

          this.logger.error({ message: err });
          process.exit(1);
        },
      );
    });
  }

  addExpense(expense: NewExpenseRequest): Promise<void> {
    const finalExpense = this.trimRequestInfo(expense);
    return new Promise<void>((resolve, reject) => {
      this.client.AddExpense(finalExpense, (err, response) => {
        if (err) {
          reject(err);
          return;
        }

        if (!response) {
          reject(new Error("Fatal error. No response"));
          return;
        }

        const { code } = response as ExpenseReply;

        if (code !== ResponseCode.Success) {
          reject(GrpcError.fromResponse(response, expense));
          return;
        }

        resolve();
      });
    });
  }

  private trimRequestInfo(newExpense: NewExpenseRequest): NewExpenseRequest {
    const newObj = structuredClone(newExpense);

    const { expenseInfo } = newObj;

    if (!expenseInfo) {
      throw new Error(`Expense info cannot be undefined: ${newExpense}`);
    }

    type Entry = [keyof ExpenseInfo, unknown];

    // syntax magic
    for (const [key, value] of Object.entries(expenseInfo) as Entry[]) {
      if (typeof value === "string") {
        /*
          The TS compiler is getting confused here
          and is having a hard time realizing that newObj[key] actually
          is supposed to be holding a string
        */
        // @ts-ignore
        expenseInfo[key] = value.trim();
      }
    }

    return newObj;
  }
}
