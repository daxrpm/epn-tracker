import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteSimulation,
  getSimulation,
  listSimulations,
  runSimulation,
  type SaveSimulationPayload,
  saveSimulation,
  type SimulationRunPayload,
} from "./api";

export const simulationKeys = {
  saved: ["simulation", "saved"] as const,
  detail: (id: string) => ["simulation", "saved", id] as const,
};

export function useRunSimulation() {
  return useMutation({
    mutationFn: (payload: SimulationRunPayload) => runSimulation(payload),
  });
}

export function useSavedSimulations() {
  return useQuery({ queryKey: simulationKeys.saved, queryFn: listSimulations });
}

export function useSimulation(id: string | null) {
  return useQuery({
    queryKey: simulationKeys.detail(id ?? ""),
    queryFn: () => getSimulation(id as string),
    enabled: Boolean(id),
  });
}

export function useSaveSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveSimulationPayload) => saveSimulation(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: simulationKeys.saved });
    },
  });
}

export function useDeleteSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSimulation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: simulationKeys.saved });
    },
  });
}
