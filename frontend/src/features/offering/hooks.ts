import { useQuery } from "@tanstack/react-query";

import { searchProfessors } from "./api";

export function useSearchProfessors(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["offering", "professors", "search", q],
    queryFn: () => searchProfessors(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}
