import winston from "winston";
import { format } from "logform";

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

const specialChars = {
  /*_: "\\_",
  "*": "\\*",
  "[": "\\[",
  "]": "\\]",
  "(": "\\(",
  ")": "\\)",
  "~": "\\~",
  "`": "\\`",
  ">": "\\>",
  "#": "\\#",
  "+": "\\+",*/
  "-": "\\-",
  /*"=": "\\=",
  "|": "\\|",
  "{": "\\{",
  "}": "\\}",*/
  ".": "\\.",
  // "!": "\\!",
};

const escapeRegex = new RegExp(
  "[" + Object.values(specialChars).join("") + "]",
  "g"
);

export function escapeMarkdownMessage(message: string): string {
  return message.replace(
    escapeRegex,
    (r) => specialChars[r as keyof typeof specialChars] || r
  );
}

export function createLogger(serviceName: string) {
  return winston.createLogger({
    level: "silly",
    defaultMeta: { service: serviceName },
    transports: [new winston.transports.Console()],
    format: format.combine(
      format.timestamp(),
      format.errors({ stack: true }),
      format.json()
    ),
  });
}
