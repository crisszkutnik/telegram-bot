import winston from "winston";

export function countCharacter(string: string, character: string) {
  let count = 0;

  for (const char of string) {
    if (char === character) {
      count++;
    }
  }

  return count;
}

export function isValidDate(date: Date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

// Limitation here if we want to use it from another part of the world
export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\//g, "-");
}

export function escapeMessage(message: string) {
  return message.replace(/-/g, "\\-");
}

export function createLogger(serviceName: string) {
  return winston.createLogger({
    level: "silly",
    defaultMeta: { service: serviceName },
    transports: [new winston.transports.Console()],
  });
}
