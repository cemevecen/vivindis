"use client";

import { useCallback } from "react";

type GetTokenFn = () => Promise<string | null>;

export function usePublicToken(): GetTokenFn {
  return useCallback(async () => null, []);
}
