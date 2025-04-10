namespace NodeJS {
  interface ProcessEnv {
    TELEGRAM_BOT_TOKEN: string;
    EXPENSES_API_URL: string;
    GRPC_WAIT_FOR_READY_TIMEOUT: string;
    DB_URL: string;
    DB_MAX_CONNECTIONS: string;
    KAFKA_CLIENT_ID: string;
    KAFKA_BROKERS: string;
    KAFKA_CONSUMER_GROUP_ID: string;
  }
}
