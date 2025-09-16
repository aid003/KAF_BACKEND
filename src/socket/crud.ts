import {
  searchByKeyword,
  searchBySimilarity,
  searchHybrid,
} from "../services/weaviate";

type WeaviateField = string | number | boolean | object | null;

interface WeaviateNonGenericObject {
  metadata: Record<string, unknown>;
  properties: Record<string, WeaviateField>;
  uuid: string;
  vectors: Record<string, unknown>;
}

interface Propertie {
  language: string;
  title: string;
  author: string;
  text: string;
  page: number;
  published_year: number;
}

export type Output = Omit<WeaviateNonGenericObject, "properties"> & {
  properties: Propertie;
};

interface InputParams {
  queryText: string;
  limit?: number;
  alpha?: number;
}

export async function searchSimilarity({
  queryText,
  limit = 5,
}: InputParams): Promise<Array<Output> | undefined> {
  if (!queryText) return;

  const results = (await searchBySimilarity(
    queryText,
    limit
  )) as WeaviateNonGenericObject[];
  return (
    results?.map((result) => ({
      ...result,
      properties: result.properties as unknown as Propertie,
    })) || []
  );
}

export async function searchKeyword({
  queryText,
  limit = 5,
}: InputParams): Promise<Array<Output> | undefined> {
  if (!queryText) return;

  const results = (await searchByKeyword(
    queryText,
    limit
  )) as WeaviateNonGenericObject[];
  return (
    results?.map((result) => ({
      ...result,
      properties: result.properties as unknown as Propertie,
    })) || []
  );
}

export async function searchHybrids({
  queryText,
  limit = 5,
  alpha = 0.5,
}: InputParams): Promise<Array<Output> | undefined> {
  if (!queryText) return;

  const results = (await searchHybrid(
    queryText,
    limit,
    alpha
  )) as WeaviateNonGenericObject[];
  return (
    results?.map((result) => ({
      ...result,
      properties: result.properties as unknown as Propertie,
    })) || []
  );
}
