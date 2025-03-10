import { GrpcService } from "./grpcService";
import { TelegramService } from "./telegramService";

async function main() {
  const grpcService = new GrpcService();
  const telegramService = new TelegramService(grpcService);

  await telegramService.launch();
}

main();
