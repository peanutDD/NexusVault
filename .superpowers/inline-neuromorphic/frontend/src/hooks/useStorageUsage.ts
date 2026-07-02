import { useQuery } from "@tanstack/react-query";
import { fileService } from "../services/files";
import type { StorageUsage } from "../types/files";

export function useStorageUsage() {
  return useQuery<StorageUsage>({
    queryKey: ["storageUsage"],
    queryFn: () => fileService.getStorageUsage(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
