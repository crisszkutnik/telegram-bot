import { credentials, loadPackageDefinition } from "@grpc/grpc-js";
import { loadSync } from "@grpc/proto-loader";
import { EXPENSES_API_URL, GRPC_WAIT_FOR_READY_TIMEOUT } from "./config";
import type { ProtoGrpcType } from "./proto/Expense";
import type { ExpensesClient } from "./proto/proto/Expenses";
import type { NewExpenseRequest } from "./proto/proto/NewExpenseRequest";
import type { ExpenseReply } from "./proto/proto/ExpenseReply";
import { createLogger } from "./utils";

const PROTO_PATH = "./proto/Expense.proto";

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
      packageDefinition
    ) as unknown as ProtoGrpcType;

    this.client = new protoDescriptor.proto.Expenses(
      EXPENSES_API_URL,
      credentials.createInsecure()
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
        }
      );
    });
  }

  addExpense(expense: NewExpenseRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.client.AddExpense(expense, (err, response) => {
        if (err) {
          reject(err);
          return;
        }

        if (!response) {
          reject("Fatal error. No response");
          return;
        }

        const { success, message } = response as ExpenseReply;

        if (!success) {
          reject(message);
          return;
        }

        resolve();
      });
    });
  }
}
