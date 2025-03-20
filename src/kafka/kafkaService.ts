import { EachMessageHandler, EachMessagePayload, Kafka } from "kafkajs";
import { createLogger } from "../utils";
import { PostgresService } from "../postgres/postgresService";
import { TelegramService } from "../telegram/telegramService";

interface NewExpenseMessage {
  userId: string;
  notificationInfo: {
    app: string;
    vendor: string;
    paymentMethod: string;
    amount: number;
  };
}

/*

{
  "userId": "0195b116-dbc7-754d-a323-c5426596cf86",
  "notificationInfo": {
    "app": "Banco Galicia",
    "vendor": "SOME VENDOR",
    "paymentMethod": "VISA Galicia",
    "amount": 400.45
  }
}

*/

export class KafkaService {
  private readonly logger = createLogger(KafkaService.name);
  private readonly kafka;
  private readonly consumer;
  private readonly handlers: Record<string, EachMessageHandler> = {
    "notification.new": this.newNotificationHandler.bind(this),
  } as const;

  constructor(
    private readonly postgresService: PostgresService,
    private readonly telegramService: TelegramService
  ) {
    this.kafka = new Kafka({
      clientId: "app",
      brokers: ["localhost:9092"],
    });
    this.consumer = this.kafka.consumer({ groupId: "test-group" });
  }

  async init() {
    await this.consumer.connect();

    const topics = Object.keys(this.handlers);

    await Promise.all(
      topics.map(async (topic) => {
        await this.consumer.subscribe({ topic, fromBeginning: true });
        this.logger.info(`Subscribed to topic ${topic}`);
      })
    );

    this.logger.info("Starting Kafka listener");
    await this.consumer.run({
      eachMessage: async (payload) => {
        const { topic } = payload;
        const handler = this.handlers[topic];

        if (handler === undefined) {
          this.logger.info(`No handler for topic ${topic}`);
          return;
        }

        handler(payload);
      },
    });
  }

  async newNotificationHandler({ message }: EachMessagePayload) {
    const msgStr = message.value?.toString();

    if (msgStr === undefined) {
      this.logger.error(
        `Message value for topic 'notification.new' is undefined`
      );
      return;
    }

    const kafkaPayload = JSON.parse(msgStr) as NewExpenseMessage;
    const { userId, notificationInfo } = kafkaPayload;

    const telegramUserId =
      await this.postgresService.getTelegramUserIdFromUserId(userId);

    const msg = `
    Detectamos el siguiente gasto en la aplicacion *${notificationInfo.app}*

    - *__Nombre:__* ${notificationInfo.vendor}
    - *__Metodo de pago:__* ${notificationInfo.paymentMethod}
    - *__Moneda:__* ARS
    - *__Monto:__* ${notificationInfo.amount}
    `;

    const finalMsg = await this.telegramService.sendMessage(
      telegramUserId,
      msg
    );

    await this.postgresService.insertNotification({
      app: kafkaPayload.notificationInfo.app,
      vendor: kafkaPayload.notificationInfo.vendor,
      payment_method: kafkaPayload.notificationInfo.paymentMethod,
      amount: kafkaPayload.notificationInfo.amount,
      user_id: userId,
      telegram_message_id: finalMsg.message_id,
    });
  }
}
