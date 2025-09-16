import logger from "./services/utils/logger";
import "./server";
import { askQuestion } from "./services/ollama";

async function main() {
  

  // const userQuery = "Что такое постмодернизм?";
  // const answer = await askQuestion(userQuery, []);
  // console.log("\n\nПолный ответ:\n", answer);
}

main().catch((err) => {
  logger.error(err);
});
