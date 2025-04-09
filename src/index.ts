import { GrpcService } from "./grpcService";
import { KafkaService } from "./kafka/kafkaService";
import { PostgresService } from "./postgres/postgresService";
import { TelegramService } from "./telegram/telegramService";

async function main() {
  const grpcService = new GrpcService();
  await grpcService.init();

  const postgresService = new PostgresService();

  await postgresService.init();

  const telegramService = new TelegramService(grpcService, postgresService);

  const kafkaService = new KafkaService(postgresService, telegramService);

  await Promise.all([telegramService.launch(), kafkaService.init()]);
}

main();
