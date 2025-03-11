import "dotenv/config";

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const EXPENSES_API_URL = process.env.EXPENSES_API_URL;
export const GRPC_WAIT_FOR_READY_TIMEOUT =
  Number(process.env.GRPC_WAIT_FOR_READY_TIMEOUT) || 5000;
