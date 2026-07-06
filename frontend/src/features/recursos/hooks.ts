import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveResource,
  createFileResource,
  createLinkResource,
  deleteResource,
  type FileResourceInput,
  type LinkResourceInput,
  type ResourceFilters,
  getResource,
  listPendingResources,
  listResources,
  rejectResource,
  voteResource,
} from "./api";

export const recursoKeys = {
  all: ["recursos"] as const,
  list: (filters: ResourceFilters) => ["recursos", "list", filters] as const,
  detail: (id: string) => ["recursos", "detail", id] as const,
  pending: ["recursos", "pending"] as const,
};

export function useResources(filters: ResourceFilters, enabled = true) {
  return useQuery({
    queryKey: recursoKeys.list(filters),
    queryFn: () => listResources(filters),
    enabled,
  });
}

export function useResource(id: string | null) {
  return useQuery({
    queryKey: recursoKeys.detail(id ?? ""),
    queryFn: () => getResource(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateFileResource(onProgress?: (fraction: number) => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FileResourceInput) => createFileResource(input, onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: recursoKeys.all }),
  });
}

export function useCreateLinkResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LinkResourceInput) => createLinkResource(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: recursoKeys.all }),
  });
}

export function useVoteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voteResource(id, "APPROVE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: recursoKeys.all }),
  });
}

export function usePendingResources(enabled = true) {
  return useQuery({
    queryKey: recursoKeys.pending,
    queryFn: listPendingResources,
    enabled,
  });
}

export function useModerateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "approve" | "reject" | "delete" }) => {
      if (action === "approve") await approveResource(id);
      else if (action === "reject") await rejectResource(id);
      else await deleteResource(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: recursoKeys.all }),
  });
}
