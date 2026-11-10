import type { Dataset } from "./datasets";
import { createSampleDatasets } from "./sample-datasets";

/** Imported datasets stay on this browser origin, separate from experiment sources. */
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("magic-data-v1", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("datasets", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Close other MagicLab tabs and retry."));
  });
}

async function access<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("datasets", mode);
      const request = operation(transaction.objectStore("datasets"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () =>
        reject(
          transaction.error ??
            request.error ??
            new Error("Dataset storage failed."),
        );
      transaction.onerror = () => reject(transaction.error ?? request.error);
    });
  } finally {
    db.close();
  }
}

export const listDatasets = async () => [
  ...createSampleDatasets(),
  ...(await access<Dataset[]>("readonly", (store) => store.getAll())),
];
export const saveDataset = (dataset: Dataset) =>
  access("readwrite", (store) => store.put(dataset));
export const deleteDataset = (id: string) =>
  access("readwrite", (store) => store.delete(id));
