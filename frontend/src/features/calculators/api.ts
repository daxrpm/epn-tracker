import { apiClient } from "@/lib/api/client";

export interface RecoveryInput {
  aporte_1: string;
  aporte_2: string;
}

export interface RecoveryResult {
  final_40: string;
  final_20: string;
  display_final_20: string;
  status: "APPROVED" | "RECOVERY_ELIGIBLE" | "FAILED_DIRECT" | "IN_PROGRESS";
  required_recovery_score_40: string | null;
  display_required_recovery_score_40: string | null;
}

/** Anonymous recovery calculator (ERS §17.11, §RF-010). No authentication required. */
export async function calculateRecovery(input: RecoveryInput): Promise<RecoveryResult> {
  const { data } = await apiClient.post<RecoveryResult>(
    "/public/calculators/recovery",
    input,
  );
  return data;
}
