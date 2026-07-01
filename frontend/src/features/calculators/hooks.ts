import { useMutation } from "@tanstack/react-query";

import { calculateRecovery } from "./api";

export function useRecoveryCalculator() {
  return useMutation({ mutationFn: calculateRecovery });
}
