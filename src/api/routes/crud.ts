import { Router, Request, Response } from "express";
import {
  createCollection,
  deleteAllCollections,
  searchByKeyword,
  searchBySimilarity,
  searchHybrid,
  testAddDocument,
} from "../../services/weaviate";
import logger from "../../services/utils/logger";
import { startLocalProcess } from "../../services/utils/fragmentTextServer";

const router = Router();

router.post("/search/similarity", async (req: Request, res: Response) => {
  const { queryText, limit = 5 } = req.body;

  if (!queryText) {
    res.status(400).json({ error: "Требуется параметр 'queryText'" });
    return;
  }

  const results = await searchBySimilarity(queryText, limit);
  res.json(results || []);
  return;
});

router.post(
  "/search/keyword",
  async (req: Request, res: Response): Promise<void> => {
    const { queryText, limit = 5 } = req.body;

    if (!queryText) {
      res.status(400).json({ error: "Требуется параметр 'queryText'" });
      return;
    }

    const results = await searchByKeyword(queryText, limit);
    res.json(results || []);
    return;
  }
);

router.post(
  "/search/hybrid",
  async (req: Request, res: Response): Promise<void> => {
    const { queryText, limit = 5, alpha = 0.5 } = req.body;

    if (!queryText) {
      res.status(400).json({ error: "Требуется параметр 'queryText'" });
      return;
    }

    const results = await searchHybrid(queryText, limit, alpha);
    res.json(results || []);
    return;
  }
);

router.post(
  "/collections/create",
  async (req: Request, res: Response): Promise<void> => {
    const collection = await createCollection();
    if (!collection) {
      res.status(500).json({ error: "Ошибка при создании коллекции" });
      return;
    }
    res.json({ message: "Коллекция создана", collection });
    return;
  }
);

router.post(
  "/collections/delete",
  async (req: Request, res: Response): Promise<void> => {
    try {
      await deleteAllCollections();
      res.json({ message: "Все коллекции удалены" });
      return;
    } catch (error) {
      logger.error(`Ошибка при удалении коллекций: ${error}`);
      res.status(500).json({ error: "Ошибка при удалении коллекций" });
      return;
    }
  }
);

router.post("/documents/test", async (req: Request, res: Response) => {
  try {
    await testAddDocument();
    res.status(200).json({ message: "Тестовый документ добавлен" });
    return;
  } catch (error) {
    logger.error(`Ошибка при тестовом добавлении документа: ${error}`);
    res.status(500).json({ error: "Ошибка при тестовом добавлении документа" });
    return;
  }
});

// 🔹 Новый роут для запуска локального процесса
router.post("/process/start", async (req: Request, res: Response) => {
  try {
    await startLocalProcess();
    res.status(200).json({ message: "Локальный процесс запущен" });
    return;
  } catch (error) {
    logger.error(`Ошибка при запуске локального процесса: ${error}`);
    res.status(500).json({ error: "Ошибка при запуске локального процесса" });
    return;
  }
});

export default router;
