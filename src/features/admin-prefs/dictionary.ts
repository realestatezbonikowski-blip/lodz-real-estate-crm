import { en } from "./dict-en.ts";
import { pl } from "./dict-pl.ts";

export type MessageKey = keyof typeof pl;
export const dictionaries = { pl, en } as const;
