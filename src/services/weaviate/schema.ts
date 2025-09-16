// Интерфейс для описания схемы коллекции
export interface MyCollectionConfig {
  class: string; // Имя коллекции, которое будем использовать при создании (оно же название класса)
  description: string;
  vectorizer: string;
  properties: Array<{
    name: string;
    dataType: string[];
    description: string;
  }>;
  moduleConfig?: Record<string, any>;
}

export const collectionConfig: MyCollectionConfig = {
  class: "BookFragments",
  description: "Collection for storing book excerpts with semantic search",
  vectorizer: "text2vec-transformers",
  properties: [
    {
      name: "title",
      dataType: ["text"],
      description: "The title of the book",
    },
    {
      name: "author",
      dataType: ["text"],
      description: "The author of the book",
    },
    {
      name: "text",
      dataType: ["text"],
      description: "A short excerpt from the book",
    },
    {
      name: "page",
      dataType: ["int"],
      description: "The page number of the excerpt",
    },
    {
      name: "published_year",
      dataType: ["int"],
      description: "The year the book was published",
    },
    {
      name: "language",
      dataType: ["text"],
      description: "The language of the book (e.g., 'en', 'ru')",
    },
  ],
  moduleConfig: {
    "text2vec-transformers": {
      sourceProperties: ["title", "author", "text", "language"],
    },
  },
};
