import axios from "axios";
import { QueryClient } from "@tanstack/react-query";

export const appQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error: unknown) => {
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status != null && [401, 403, 404].includes(status)) return false;
        }
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
    },
  },
});
