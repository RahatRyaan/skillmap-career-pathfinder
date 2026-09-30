/**
 * Admin list loading and deletion.
 *
 * One hook so every admin table gets the same refetch-on-delete behaviour
 * instead of each page reimplementing it slightly differently.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useAdminList<T>(key: string, fetcher: () => Promise<T>) {
  const queryClient = useQueryClient();

  const query = useQuery({ queryKey: ['admin', key], queryFn: fetcher });

  const deletion = useMutation({
    mutationFn: async (target: () => Promise<unknown>) => target(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', key] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-impact'] });
    },
  });

  return {
    ...query,
    // Narrowed here so every page gets a non-optional payload after its own
    // isLoading / isError guards, instead of re-narrowing in each file.
    data: query.data as T,
    deleteOne: deletion.mutate,
    isDeleting: deletion.isPending,
  };
}
