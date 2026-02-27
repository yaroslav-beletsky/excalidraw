import { atom } from "../app-jotai";

import type { AuthState } from "./types";

export const authUserAtom = atom<AuthState | null>(null);
