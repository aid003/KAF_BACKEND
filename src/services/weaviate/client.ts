import weaviate, { WeaviateClient } from "weaviate-client";
import logger from "../utils/logger";

let client: WeaviateClient | null = null;

export const connectToWeaviate = async (): Promise<WeaviateClient> => {
  if (!client) {
    client = await weaviate.connectToLocal();
    const isReady = await client.isReady();

    if (!isReady) {
      throw new Error("Weaviate is not ready");
    }

    logger.info("✅ Weaviate client connected successfully");
  }
  return client;
};

export const closeWeaviate = async () => {
  if (client) {
    client.close();
    logger.info("🔌 Weaviate connection closed");
    client = null;
  }
};
