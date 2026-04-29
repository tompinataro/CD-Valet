import { Platform } from 'react-native';

export type CdLookupMetadata = {
  artist: string | null;
  albumTitle: string | null;
  format: string;
  releaseYear: string | null;
  label: string | null;
  catalogNumber: string | null;
  trackCount: number | null;
  musicBrainzId: string | null;
};

export type CdLookupResult =
  | { kind: 'found'; metadata: CdLookupMetadata }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

type MusicBrainzRelease = {
  id?: string;
  title?: string;
  date?: string;
  'artist-credit'?: Array<{ name?: string; artist?: { name?: string }; joinphrase?: string }>;
  'label-info'?: Array<{ label?: { name?: string }; 'catalog-number'?: string }>;
  media?: Array<{ format?: string; 'track-count'?: number; tracks?: unknown[] }>;
};

function clean(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function artistCredit(release: MusicBrainzRelease) {
  const credits = release['artist-credit'];
  if (!credits?.length) return null;

  const name = credits
    .map((credit) => `${credit.name || credit.artist?.name || ''}${credit.joinphrase || ''}`)
    .join('')
    .trim();

  return name || null;
}

function inferFormat(release: MusicBrainzRelease) {
  const formats = release.media?.map((medium) => clean(medium.format)).filter(Boolean) as string[] | undefined;
  if (!formats?.length) return 'CD';
  if (formats.length > 1) return 'Box Set';
  if (formats.some((format) => format.toLowerCase().includes('single'))) return 'Single';
  return formats.some((format) => format.toLowerCase().includes('cd')) ? 'CD' : formats[0];
}

function trackCount(release: MusicBrainzRelease) {
  const counts = release.media
    ?.map((medium) => medium['track-count'] ?? medium.tracks?.length ?? 0)
    .filter((count) => Number.isFinite(count) && count > 0);

  if (!counts?.length) return null;
  return counts.reduce((sum, count) => sum + Number(count), 0);
}

export async function lookupCdByBarcode(upc: string): Promise<CdLookupResult> {
  const query = encodeURIComponent(`barcode:${upc.trim()}`);
  const url = `https://musicbrainz.org/ws/2/release/?query=${query}&fmt=json&limit=1`;
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (Platform.OS !== 'web') {
    headers['User-Agent'] = 'CDValet/1.0.0 (https://tixpy.com)';
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      return { kind: 'error', message: `MusicBrainz lookup failed (${response.status})` };
    }

    const data = await response.json();
    const release = data?.releases?.[0] as MusicBrainzRelease | undefined;
    if (!release) return { kind: 'not_found' };

    const labelInfo = release['label-info']?.[0];
    return {
      kind: 'found',
      metadata: {
        artist: artistCredit(release),
        albumTitle: clean(release.title),
        format: inferFormat(release),
        releaseYear: clean(release.date)?.slice(0, 4) ?? null,
        label: clean(labelInfo?.label?.name),
        catalogNumber: clean(labelInfo?.['catalog-number']),
        trackCount: trackCount(release),
        musicBrainzId: clean(release.id),
      },
    };
  } catch (error: any) {
    return { kind: 'error', message: String(error?.message || error) };
  }
}
