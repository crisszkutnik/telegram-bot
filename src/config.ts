import "dotenv/config";

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const EXPENSES_API_URL = process.env.EXPENSES_API_URL;
export const GRPC_WAIT_FOR_READY_TIMEOUT =
  Number(process.env.GRPC_WAIT_FOR_READY_TIMEOUT) || 5000;
export const DB_URL = process.env.DB_URL || "";
export const DB_MAX_CONNECTIONS = Number(process.env.DB_MAX_CONNECTIONS) || 2;

export const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || "telegram-bot";
export const KAFKA_BROKERS = process.env.KAFKA_BROKERS.split(",");
export const KAFKA_CONSUMER_GROUP_ID =
  process.env.KAFKA_CONSUMER_GROUP_ID || "telegram-bot";
