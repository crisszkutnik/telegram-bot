import { credentials, loadPackageDefinition } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { EXPENSES_API_URL } from "./config";
import type { ProtoGrpcType } from "./proto/Expense";
import type { ExpenseReply } from "./proto/proto/ExpenseReply";
import type { ExpensesClient } from "./proto/proto/Expenses";
import type { NewExpenseRequest } from "./proto/proto/NewExpenseRequest";

const PROTO_PATH = "./proto/Expense.proto";

export class GrpcService {
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

  addExpense(expense: NewExpenseRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.client.AddExpense(expense, (err, response) => {
        if (err) {
          reject(err);
        }

        if (!response) {
          reject("Fatal error. No response");
        }

        const { success, message } = response as ExpenseReply;

        if (!success) {
          reject(message);
        }

        resolve();
      });
    });
  }
}
