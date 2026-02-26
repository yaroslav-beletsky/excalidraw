import { useEffect } from "react";

import { useAtom } from "../app-jotai";

import { authUserAtom } from "./authAtom";

import type { AuthState } from "./types";

const fetchAuthUser = async (): Promise<AuthState> => {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) {
      return { authenticated: false };
    }
    return await res.json();
  } catch {
    return { authenticated: false };
  }
};

export const useAuth = () => {
  const [authUser, setAuthUser] = useAtom(authUserAtom);

  useEffect(() => {
    fetchAuthUser().then(setAuthUser);
  }, [setAuthUser]);

  return authUser;
};
