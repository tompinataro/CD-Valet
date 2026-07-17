import * as SQLite from 'expo-sqlite';
import { STARTUP_TIMEOUT_MS, withTimeout } from './startup';

export type CdLibraryItem = {
  upc: string;
  artist: string | null;
  album_title: string | null;
  format: string;
  release_year: string | null;
  label: string | null;
  catalog_number: string | null;
  track_count: number | null;
  musicbrainz_id: string | null;
  lookup_status: string;
  lookup_source: string | null;
  notes: string | null;
  first_scanned_at: string;
  last_scanned_at: string;
};

export type CdLibraryUpdate = {
  upc: string;
  artist: string;
  albumTitle: string;
  format: string;
  releaseYear: string;
  label: string;
  catalogNumber: string;
  trackCount: string;
  notes: string;
};

export type CdMetadataUpdate = {
  upc: string;
  artist?: string | null;
  albumTitle?: string | null;
  format?: string | null;
  releaseYear?: string | null;
  label?: string | null;
  catalogNumber?: string | null;
  trackCount?: number | null;
  musicBrainzId?: string | null;
  lookupStatus: 'found' | 'not_found' | 'error' | 'manual';
  lookupSource?: string | null;
};

export type AuthSession = {
  email: string;
  name: string;
  signed_in_at: string;
};

const DB_NAME = 'cd_valet.db';
const STARTER_CDS_SEEDED_FLAG = 'starter_cds_seeded';
const DAY_MS = 24 * 60 * 60 * 1000;

const STARTER_CDS = [
  {
    upc: '074646492325',
    artist: 'Miles Davis',
    albumTitle: 'Kind of Blue',
    releaseYear: '1959',
    label: 'Columbia',
    catalogNumber: 'CK 64935',
    trackCount: 5,
    offsetDays: 1,
  },
  {
    upc: '094638246824',
    artist: 'The Beatles',
    albumTitle: 'Abbey Road',
    releaseYear: '1969',
    label: 'Apple Records',
    catalogNumber: '0946 3 82468 2 4',
    trackCount: 17,
    offsetDays: 2,
  },
  {
    upc: '075678159624',
    artist: 'Fleetwood Mac',
    albumTitle: 'Rumours',
    releaseYear: '1977',
    label: 'Warner Bros.',
    catalogNumber: '3010-2',
    trackCount: 11,
    offsetDays: 3,
  },
  {
    upc: '075992725526',
    artist: 'Prince and The Revolution',
    albumTitle: 'Purple Rain',
    releaseYear: '1984',
    label: 'Warner Bros.',
    catalogNumber: '25110-2',
    trackCount: 9,
    offsetDays: 4,
  },
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = withTimeout(SQLite.openDatabaseAsync(DB_NAME), STARTUP_TIMEOUT_MS, 'Opening local database')
      .catch((error) => {
        dbPromise = null;
        throw error;
      });
  }
  return dbPromise;
}

export async function ensureSchema() {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS upc_queue (
      upc TEXT PRIMARY KEY,
      first_scanned_at TEXT NOT NULL,
      last_scanned_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cd_library (
      upc TEXT PRIMARY KEY,
      artist TEXT,
      album_title TEXT,
      format TEXT NOT NULL DEFAULT 'CD',
      release_year TEXT,
      label TEXT,
      catalog_number TEXT,
      track_count INTEGER,
      musicbrainz_id TEXT,
      lookup_status TEXT NOT NULL DEFAULT 'manual',
      lookup_source TEXT,
      notes TEXT,
      first_scanned_at TEXT NOT NULL,
      last_scanned_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_session (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      signed_in_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_flags (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    INSERT OR IGNORE INTO cd_library (upc, first_scanned_at, last_scanned_at)
    SELECT upc, first_scanned_at, last_scanned_at
    FROM upc_queue;
  `);
  await ensureCdLibraryColumns(db);
  await seedStarterCds(db);
}

async function ensureCdLibraryColumns(db: SQLite.SQLiteDatabase) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(cd_library);`);
  const existing = new Set(columns.map((column) => column.name));
  const migrations = [
    ['release_year', `ALTER TABLE cd_library ADD COLUMN release_year TEXT;`],
    ['label', `ALTER TABLE cd_library ADD COLUMN label TEXT;`],
    ['catalog_number', `ALTER TABLE cd_library ADD COLUMN catalog_number TEXT;`],
    ['track_count', `ALTER TABLE cd_library ADD COLUMN track_count INTEGER;`],
    ['musicbrainz_id', `ALTER TABLE cd_library ADD COLUMN musicbrainz_id TEXT;`],
    ['lookup_status', `ALTER TABLE cd_library ADD COLUMN lookup_status TEXT NOT NULL DEFAULT 'manual';`],
    ['lookup_source', `ALTER TABLE cd_library ADD COLUMN lookup_source TEXT;`],
  ] as const;

  for (const [name, sql] of migrations) {
    if (!existing.has(name)) {
      await db.execAsync(sql);
    }
  }
}

async function setAppFlag(db: SQLite.SQLiteDatabase, key: string, value = 'true') {
  await db.runAsync(
    `INSERT INTO app_flags (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value]
  );
}

async function seedStarterCds(db: SQLite.SQLiteDatabase) {
  const seeded = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_flags WHERE key = ?;`,
    [STARTER_CDS_SEEDED_FLAG]
  );
  if (seeded) return;

  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM cd_library;`);
  if ((row?.count ?? 0) > 0) {
    await setAppFlag(db, STARTER_CDS_SEEDED_FLAG);
    return;
  }

  const now = Date.now();
  for (const cd of STARTER_CDS) {
    const scannedAt = new Date(now - cd.offsetDays * DAY_MS).toISOString();
    await db.runAsync(
      `INSERT OR IGNORE INTO cd_library (
        upc, artist, album_title, format, release_year, label, catalog_number,
        track_count, musicbrainz_id, lookup_status, lookup_source, notes,
        first_scanned_at, last_scanned_at
      )
      VALUES (?, ?, ?, 'CD', ?, ?, ?, ?, NULL, 'found', 'cd-valet-starter', ?, ?, ?);`,
      [
        cd.upc,
        cd.artist,
        cd.albumTitle,
        cd.releaseYear,
        cd.label,
        cd.catalogNumber,
        cd.trackCount,
        'Starter data for export and delete testing.',
        scannedAt,
        scannedAt,
      ]
    );
  }

  await setAppFlag(db, STARTER_CDS_SEEDED_FLAG);
}

export async function upsertScannedCd(upcRaw: string) {
  const upc = upcRaw.trim();
  if (!upc) return;

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO cd_library (upc, lookup_status, first_scanned_at, last_scanned_at)
     VALUES (?, 'pending', ?, ?)
     ON CONFLICT(upc) DO UPDATE SET
       last_scanned_at = excluded.last_scanned_at,
       lookup_status = CASE
         WHEN cd_library.lookup_status = 'found' THEN cd_library.lookup_status
         ELSE 'pending'
       END;`,
    [upc, now, now]
  );
}

export async function createManualCd(): Promise<CdLibraryItem> {
  const db = await getDb();
  const now = new Date().toISOString();
  const upc = `manual-${Date.now()}`;

  await db.runAsync(
    `INSERT INTO cd_library (upc, format, lookup_status, first_scanned_at, last_scanned_at)
     VALUES (?, 'CD', 'manual', ?, ?);`,
    [upc, now, now]
  );

  return {
    upc,
    artist: null,
    album_title: null,
    format: 'CD',
    release_year: null,
    label: null,
    catalog_number: null,
    track_count: null,
    musicbrainz_id: null,
    lookup_status: 'manual',
    lookup_source: null,
    notes: null,
    first_scanned_at: now,
    last_scanned_at: now,
  };
}

export async function updateCdDetails(update: CdLibraryUpdate) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE cd_library
     SET artist = NULLIF(TRIM(?), ''),
         album_title = NULLIF(TRIM(?), ''),
         format = COALESCE(NULLIF(TRIM(?), ''), 'CD'),
         release_year = NULLIF(TRIM(?), ''),
         label = NULLIF(TRIM(?), ''),
         catalog_number = NULLIF(TRIM(?), ''),
         track_count = CAST(NULLIF(TRIM(?), '') AS INTEGER),
         lookup_status = CASE WHEN lookup_status = 'found' THEN lookup_status ELSE 'manual' END,
         notes = NULLIF(TRIM(?), '')
     WHERE upc = ?;`,
    [
      update.artist,
      update.albumTitle,
      update.format,
      update.releaseYear,
      update.label,
      update.catalogNumber,
      update.trackCount,
      update.notes,
      update.upc,
    ]
  );
}

export async function updateCdMetadata(update: CdMetadataUpdate) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE cd_library
     SET artist = COALESCE(NULLIF(TRIM(?), ''), artist),
         album_title = COALESCE(NULLIF(TRIM(?), ''), album_title),
         format = COALESCE(NULLIF(TRIM(?), ''), format, 'CD'),
         release_year = COALESCE(NULLIF(TRIM(?), ''), release_year),
         label = COALESCE(NULLIF(TRIM(?), ''), label),
         catalog_number = COALESCE(NULLIF(TRIM(?), ''), catalog_number),
         track_count = COALESCE(?, track_count),
         musicbrainz_id = COALESCE(NULLIF(TRIM(?), ''), musicbrainz_id),
         lookup_status = ?,
         lookup_source = COALESCE(NULLIF(TRIM(?), ''), lookup_source)
     WHERE upc = ?;`,
    [
      update.artist ?? '',
      update.albumTitle ?? '',
      update.format ?? '',
      update.releaseYear ?? '',
      update.label ?? '',
      update.catalogNumber ?? '',
      update.trackCount ?? null,
      update.musicBrainzId ?? '',
      update.lookupStatus,
      update.lookupSource ?? '',
      update.upc,
    ]
  );
}

export async function listCdLibraryItems(): Promise<CdLibraryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CdLibraryItem>(
    `SELECT upc, artist, album_title, format, release_year, label, catalog_number,
            track_count, musicbrainz_id, lookup_status, lookup_source, notes,
            first_scanned_at, last_scanned_at
     FROM cd_library
     ORDER BY COALESCE(NULLIF(album_title, ''), upc) COLLATE NOCASE ASC;`
  );
  return rows;
}

export async function deleteCdLibraryItem(upcRaw: string) {
  const upc = upcRaw.trim();
  if (!upc) return;

  const db = await getDb();
  await db.runAsync(`DELETE FROM cd_library WHERE upc = ?;`, [upc]);
  await db.runAsync(`DELETE FROM upc_queue WHERE upc = ?;`, [upc]);
}

export async function countCdLibraryItems(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM cd_library;`
  );
  return row?.count ?? 0;
}

export async function getStoredSession(): Promise<AuthSession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AuthSession>(
    `SELECT email, name, signed_in_at
     FROM auth_session
     WHERE id = 1;`
  );
  return row ?? null;
}

export async function saveSession(session: AuthSession) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO auth_session (id, email, name, signed_in_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email,
       name = excluded.name,
       signed_in_at = excluded.signed_in_at;`,
    [session.email, session.name, session.signed_in_at]
  );
}

export async function clearSession() {
  const db = await getDb();
  await db.runAsync(`DELETE FROM auth_session WHERE id = 1;`);
}
