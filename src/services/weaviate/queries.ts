import { Collection } from "weaviate-client";
import { connectToWeaviate } from "./client";
import { collectionConfig } from "./schema";
import logger from "../utils/logger";

interface ExtendedCollectionConfig {
  name: string;
}

export const searchBySimilarity = async (queryText: string, limit = 5) => {
  const client = await connectToWeaviate();

  try {
    const collection = client.collections.get(collectionConfig.class);
    const result = await collection.query.nearText(queryText, { limit });

    logger.info("🔍 Завершил семантический поиск");
    return result.objects;
  } catch (error) {
    logger.error(`❌ Ошибка при семантическом поиске: ${error}`);
    return null;
  }
};

export const searchByKeyword = async (queryText: string, limit = 5) => {
  const client = await connectToWeaviate();

  try {
    const collection = client.collections.get(collectionConfig.class);
    const result = await collection.query.bm25(queryText, { limit });

    logger.info("🔍 Завершил поиск по ключевым словам");
    return result.objects;
  } catch (error) {
    logger.error(`❌ Ошибка при поиске по ключевым словам: ${error}`);
    return null;
  }
};

export const searchHybrid = async (
  queryText: string,
  limit = 5,
  alpha = 0.5
) => {
  const client = await connectToWeaviate();

  try {
    const collection = client.collections.get(collectionConfig.class);
    const result = await collection.query.hybrid(queryText, { alpha, limit });

    logger.info("🔍 Завершил гибридный поиск");
    return result.objects;
  } catch (error) {
    logger.error(`❌ Ошибка при гибридном поиске: ${error}`);
    return null;
  }
};

export const createCollection = async (): Promise<Collection<
  any,
  string
> | null> => {
  const client = await connectToWeaviate();

  try {
    const existingCollections =
      (await client.collections.listAll()) as ExtendedCollectionConfig[];
    const exists = existingCollections.find(
      (col) => col.name === collectionConfig.class
    );
    if (exists) {
      logger.info(`Коллекция ${collectionConfig.class} уже существует.`);
      return client.collections.get(collectionConfig.class);
    }

    const newCollection = await client.collections.createFromSchema(
      collectionConfig
    );
    logger.info(`📚 Коллекция создана: ${newCollection.name}`);
    return newCollection;
  } catch (error) {
    logger.error(`❌ Ошибка при создании коллекции: ${error}`);
    return null;
  }
};

export const deleteAllCollections = async (): Promise<void> => {
  const client = await connectToWeaviate();

  try {
    const collections =
      (await client.collections.listAll()) as ExtendedCollectionConfig[];
    for (const coll of collections) {
      await client.collections.delete(coll.name);
      logger.info(`Удалена коллекция: ${coll.name}`);
    }
  } catch (error) {
    logger.error(`❌ Ошибка при удалении коллекций: ${error}`);
  }
};

export const addDocument = async (document: any): Promise<void> => {
  const client = await connectToWeaviate();

  try {
    const existingCollections =
      (await client.collections.listAll()) as ExtendedCollectionConfig[];
    const exists = existingCollections.find(
      (col) => col.name === collectionConfig.class
    );
    if (!exists) {
      throw new Error(`Коллекция ${collectionConfig.class} не существует`);
    }

    const collection = client.collections.get(collectionConfig.class);
    await collection.data.insert(document);
    logger.info("✅ Документ успешно добавлен");
  } catch (error) {
    logger.error(`❌ Ошибка при добавлении документа: ${error}`);
  }
};

export const testAddDocument = async (): Promise<void> => {
  const testDocument = {
    title: "Sample Book Title",
    author: "Author Name",
    text: "Это пример отрывка из книги, который будет векторизован с помощью text2vec-transformers.",
    page: 10,
    published_year: 2025,
    language: "en",
  };

  await addDocument(testDocument);
};
