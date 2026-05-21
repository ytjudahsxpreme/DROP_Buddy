"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { verifyAccessCode as serverVerify } from "@/lib/data/clientDataSource";

interface AppState {
  unlockedFundraisers: string[];
  unlock: (id: string, code: string) => Promise<boolean>;
  lock: (id: string) => void;
  lockAll: () => void;
  isUnlocked: (id: string) => boolean;
}

export const useAppState = create<AppState>()(
  persist(
    (set, get) => ({
      unlockedFundraisers: [],
      unlock: async (id, code) => {
        const ok = await serverVerify(id, code);
        if (ok && !get().unlockedFundraisers.includes(id)) {
          set({ unlockedFundraisers: [...get().unlockedFundraisers, id] });
        }
        return ok;
      },
      lock: (id) =>
        set({ unlockedFundraisers: get().unlockedFundraisers.filter((x) => x !== id) }),
      lockAll: () => set({ unlockedFundraisers: [] }),
      isUnlocked: (id) => get().unlockedFundraisers.includes(id),
    }),
    {
      name: "drop-buddy:unlocked",
    },
  ),
);
