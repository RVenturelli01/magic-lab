import type { JsonObject, JsonValue } from "./types";

/** Literal keys win over nested paths, consistently in adapters and views. */
export function configValue(
  object: JsonObject,
  key: string,
): JsonValue | undefined {
  if (Object.hasOwn(object, key)) return object[key];
  let current: JsonValue | undefined = object;
  for (const part of key.split(".")) {
    if (
      !current ||
      typeof current !== "object" ||
      Array.isArray(current) ||
      !Object.hasOwn(current, part)
    )
      return;
    current = current[part];
  }
  return current;
}
