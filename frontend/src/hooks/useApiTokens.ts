import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiTokenService } from "../services/apiTokens";
import type { ApiToken, CreateApiTokenRequest } from "../services/apiTokens";

export function useApiTokens() {
  return useQuery<ApiToken[]>({
    queryKey: ["apiTokens"],
    queryFn: () => apiTokenService.listTokens(),
  });
}

export function useCreateApiToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiTokenRequest) => apiTokenService.createToken(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiTokens"] });
    },
  });
}

export function useDeleteApiToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tokenId: string) => apiTokenService.deleteToken(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiTokens"] });
    },
  });
}
