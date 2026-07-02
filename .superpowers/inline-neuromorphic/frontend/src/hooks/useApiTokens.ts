import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiTokenService } from "../services/apiTokens";
import type {
  ApiToken,
  CreateWebDavWizardTokenRequest,
  CreateApiTokenRequest,
  WebDavAccessEvent,
  WebDavDiagnostic,
  UpdateApiTokenRequest,
} from "../services/apiTokens";

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

export function useUpdateApiToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tokenId,
      data,
    }: {
      tokenId: string;
      data: UpdateApiTokenRequest;
    }) => apiTokenService.updateToken(tokenId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiTokens"] });
      queryClient.invalidateQueries({ queryKey: ["webdavDiagnostics"] });
    },
  });
}

export function useCreateWebDavWizardToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data?: CreateWebDavWizardTokenRequest) =>
      apiTokenService.createWebDavWizardToken(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiTokens"] });
      queryClient.invalidateQueries({ queryKey: ["webdavActivity"] });
      queryClient.invalidateQueries({ queryKey: ["webdavDiagnostics"] });
    },
  });
}

export function useWebDavActivity() {
  return useQuery<WebDavAccessEvent[]>({
    queryKey: ["webdavActivity"],
    queryFn: () => apiTokenService.listWebDavActivity(),
    retry: false,
    staleTime: 30_000,
  });
}

export function useWebDavDiagnostics() {
  return useQuery<WebDavDiagnostic[]>({
    queryKey: ["webdavDiagnostics"],
    queryFn: () => apiTokenService.listWebDavDiagnostics(),
    retry: false,
    staleTime: 30_000,
  });
}
