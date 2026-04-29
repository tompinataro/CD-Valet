import * as SQLite from 'expo-sqlite';
import { STARTUP_TIMEOUT_MS, withTimeout } from './startup';

export type CdLibraryItem = {
  upc: string;
  artist: string | null;
  album_title: string | null;
  format: string;
  notes: string | null;
  first_scanned_at: string;
  last_scanned_at: string;
};

export type CdLibraryUpdate = {
  upc: string;
  artist: string;
  albumTitle: string;
  format: string;
  notes: string;
};

export type AuthSession = {
  email: string;
  name: string;
  signed_in_at: string;
};

const DB_NAME = 'cd_valet.db';

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
    INSERT OR IGNORE INTO cd_library (upc, first_scanned_at, last_scanned_at)
    SELECT upc, first_scanned_at, last_scanned_at
    FROM upc_queue;
  `);
}

export async function upsertScannedCd(upcRaw: string) {
  const upc = upcRaw.trim();
  if (!upc) return;

  const db = await getDb();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO cd_library (upc, first_scanned_at, last_scanned_at)
     VALUES (?, ?, ?)
     ON CONFLICT(upc) DO UPDATE SET last_scanned_at = excluded.last_scanned_at;`,
    [upc, now, now]
  );
}

export async function createManualCd(): Promise<CdLibraryItem> {
  const db = await getDb();
  const now = new Date().toISOString();
  const upc = `manual-${Date.now()}`;

  await db.runAsync(
    `INSERT INTO cd_library (upc, format, first_scanned_at, last_scanned_at)
     VALUES (?, 'CD', ?, ?);`,
    [upc, now, now]
  );

  return {
    upc,
    artist: null,
    album_title: null,
    format: 'CD',
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
         notes = NULLIF(TRIM(?), '')
     WHERE upc = ?;`,
    [update.artist, update.albumTitle, update.format, update.notes, update.upc]
  );
}

export async function listCdLibraryItems(): Promise<CdLibraryItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CdLibraryItem>(
    `SELECT upc, artist, album_title, format, notes, first_scanned_at, last_scanned_at
     FROM cd_library
     ORDER BY COALESCE(NULLIF(album_title, ''), upc) COLLATE NOCASE ASC;`
  );
  return rows;
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
