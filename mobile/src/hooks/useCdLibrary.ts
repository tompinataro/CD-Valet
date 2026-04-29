import { useEffect, useState } from 'react';

import { ensureSchema, listCdLibraryItems, type CdLibraryItem } from '../db';
import { STARTUP_TIMEOUT_MS, toUserMessage, withTimeout } from '../startup';

export function useCdLibrary() {
  const [items, setItems] = useState<CdLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      setError(null);
      setLoading(true);
      await withTimeout(ensureSchema(), STARTUP_TIMEOUT_MS, 'Preparing local library');
      const rows = await withTimeout(listCdLibraryItems(), STARTUP_TIMEOUT_MS, 'Loading saved CDs');
      setItems(rows);
    } catch (error) {
      setItems([]);
      setError(
        toUserMessage(error, 'We could not load your saved CDs yet. You can still add your first CD.')
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { items, loading, error, refresh };
}
