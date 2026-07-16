import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult, BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { countCdLibraryItems, ensureSchema, updateCdMetadata, upsertScannedCd } from '../../src/db';
import { lookupCdByBarcode } from '../../src/musicbrainz';

const CD_BARCODE_TYPES: BarcodeType[] = Platform.select({
  ios: ['ean13', 'upc_e', 'ean8'],
  default: ['upc_a', 'ean13', 'upc_e', 'ean8'],
});

type ScanStatus =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'saving'; upc: string }
  | { kind: 'lookingUp'; upc: string }
  | { kind: 'saved'; upc: string; title?: string | null; artist?: string | null; lookup: 'found' | 'not_found' | 'error' }
  | { kind: 'error'; message: string };

function normalizeUpc(rawValue: string) {
  return String(rawValue || '').replace(/\D/g, '');
}

function isValidCdUpc(value: string) {
  return /^(?:\d{8}|\d{12}|\d{13})$/.test(value);
}

function logScanner(message: string, data?: Record<string, unknown>) {
  const suffix = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[CD Valet Scanner] ${message}${suffix}`);
}

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<ScanStatus>({ kind: 'idle' });
  const [libraryCount, setLibraryCount] = useState<number>(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUpc, setManualUpc] = useState('');
  const lastUpcRef = useRef<string | null>(null);
  const scanLockRef = useRef(false);
  const toastTimerRef = useRef<any>(null);

  useEffect(() => {
    ensureSchema()
      .then(() => countCdLibraryItems())
      .then(setLibraryCount)
      .catch(() => {
        // Startup errors surface when a save is attempted.
      });

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function showSavedToast(nextStatus: Extract<ScanStatus, { kind: 'saved' }>) {
    logScanner('save complete', {
      upc: nextStatus.upc,
      lookup: nextStatus.lookup,
      title: nextStatus.title,
      artist: nextStatus.artist,
    });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setStatus(nextStatus);
    toastTimerRef.current = setTimeout(() => {
      scanLockRef.current = false;
      setStatus({ kind: 'scanning' });
    }, 1800);
  }

  async function saveScannedUpc(upc: string) {
    if (scanLockRef.current) {
      logScanner('duplicate callback ignored', { upc, status: status.kind });
      return;
    }

    scanLockRef.current = true;
    lastUpcRef.current = upc;

    try {
      logScanner('save started', { upc });
      setStatus({ kind: 'saving', upc });
      await upsertScannedCd(upc);

      setStatus({ kind: 'lookingUp', upc });
      logScanner('album lookup started', { upc });
      const lookup = await lookupCdByBarcode(upc);
      if (lookup.kind === 'found') {
        await updateCdMetadata({
          upc,
          ...lookup.metadata,
          lookupStatus: 'found',
          lookupSource: 'MusicBrainz',
        });
        logScanner('album lookup found', {
          upc,
          title: lookup.metadata.albumTitle,
          artist: lookup.metadata.artist,
        });
      } else {
        await updateCdMetadata({
          upc,
          lookupStatus: lookup.kind === 'not_found' ? 'not_found' : 'error',
          lookupSource: 'MusicBrainz',
        });
        logScanner(lookup.kind === 'not_found' ? 'album lookup not found' : 'album lookup failed', {
          upc,
          error: lookup.kind === 'error' ? lookup.message : undefined,
        });
      }

      const newCount = await countCdLibraryItems();
      setLibraryCount(newCount);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showSavedToast({
        kind: 'saved',
        upc,
        lookup: lookup.kind,
        title: lookup.kind === 'found' ? lookup.metadata.albumTitle : null,
        artist: lookup.kind === 'found' ? lookup.metadata.artist : null,
      });
    } catch (e: any) {
      scanLockRef.current = false;
      logScanner('save failed', { upc, error: String(e?.message || e) });
      setStatus({ kind: 'error', message: String(e?.message || e) });
    }
  }

  async function handleScannedValue(rawValue: string, source: string) {
    const upc = normalizeUpc(rawValue);
    logScanner('normalized barcode value', { source, rawValue, upc });

    if (!upc) {
      logScanner('ignored empty barcode value', { source, rawValue });
      return;
    }

    if (!isValidCdUpc(upc)) {
      logScanner('ignored invalid barcode value', { source, rawValue, upc });
      return;
    }

    if (lastUpcRef.current === upc && scanLockRef.current) {
      logScanner('immediate repeat ignored', { upc });
      return;
    }

    await saveScannedUpc(upc);
  }

  async function handleBarcodeScanned(result: BarcodeScanningResult) {
    const raw = String(result.data || '').trim();
    const type = result.type || 'unknown';
    logScanner('native barcode callback', {
      type,
      data: raw,
      raw: result.raw,
      scanLocked: scanLockRef.current,
      status: status.kind,
    });

    await handleScannedValue(raw, `camera:${type}`);
  }

  function resetScanner() {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    lastUpcRef.current = null;
    scanLockRef.current = false;
    logScanner('scanner reset');
    setStatus({ kind: 'scanning' });
  }

  function openManual() {
    setManualUpc('');
    setManualOpen(true);
  }

  async function submitManual() {
    const upc = normalizeUpc(manualUpc);
    logScanner('manual submit', { rawValue: manualUpc, upc });
    if (!isValidCdUpc(upc)) {
      setStatus({ kind: 'error', message: 'Enter a valid UPC or EAN barcode.' });
      return;
    }

    setManualOpen(false);
    await saveScannedUpc(upc);
  }

  const permissionGranted = permission?.granted;

  return (
    <View style={styles.container}>
      {!permissionGranted ? (
        <View style={styles.card}>
          <Text style={styles.h1}>Scan UPC</Text>
          <Text style={styles.p}>
            Camera access is used only to scan CD UPC barcodes and add those albums to your personal library. Manual entry is available if scanning is unavailable.
          </Text>
          <Pressable onPress={requestPermission} style={styles.primaryBtn}>
            <Text style={styles.primaryText}>Enable Camera</Text>
          </Pressable>
          <Pressable onPress={openManual} style={styles.secondaryBtn}>
            <Text style={styles.secondaryText}>Enter UPC Manually</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <CameraView
            active={permissionGranted}
            style={StyleSheet.absoluteFill}
            facing="back"
            autofocus="on"
            barcodeScannerSettings={{ barcodeTypes: CD_BARCODE_TYPES }}
            onCameraReady={() => logScanner('camera ready', { barcodeTypes: CD_BARCODE_TYPES })}
            onMountError={(event) => logScanner('camera mount error', { message: event.message })}
            onBarcodeScanned={handleBarcodeScanned}
          />

          <View style={styles.overlay}>
            <View style={styles.topBar}>
              <Text style={styles.title}>Scan CDs · In library: {libraryCount}</Text>
              <View style={styles.topBarButtons}>
                <Pressable onPress={openManual} style={styles.smallBtn} hitSlop={8}>
                  <Text style={styles.smallBtnText}>Manual</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    router.replace('/(tabs)/library');
                  }}
                  style={styles.smallBtn}
                  hitSlop={8}
                >
                  <Text style={styles.smallBtnText}>Done</Text>
                </Pressable>
                <Pressable onPress={resetScanner} style={styles.smallBtn} hitSlop={8}>
                  <Text style={styles.smallBtnText}>Reset</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.scanArea}>
              <View style={styles.frame} />

              <View style={styles.toastArea}>
                {status.kind === 'saved' ? (
                  <View style={styles.toast}>
                    <Text style={styles.toastText}>
                      {status.lookup === 'found'
                        ? `Found: ${status.title || status.upc}${status.artist ? ` · ${status.artist}` : ''}`
                        : status.lookup === 'not_found'
                          ? `Saved: ${status.upc} · details needed`
                          : `Saved: ${status.upc} · lookup retry later`}
                    </Text>
                  </View>
                ) : null}
                {status.kind === 'saving' || status.kind === 'lookingUp' ? (
                  <View style={styles.toastMuted}>
                    <Text style={styles.toastText}>{status.kind === 'saving' ? 'Saving...' : 'Looking up album...'}</Text>
                  </View>
                ) : null}
                {status.kind === 'error' ? (
                  <View style={styles.toastError}>
                    <Text style={styles.toastText}>Error: {status.message}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <Text style={styles.help}>Aim the UPC inside the box to add albums to your library. Duplicates are ignored.</Text>
          </View>
        </View>
      )}

      <Modal transparent animationType="fade" visible={manualOpen} onRequestClose={() => setManualOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter UPC</Text>
            <Text style={styles.modalCopy}>Type the CD barcode if the camera cannot read it.</Text>
            <TextInput
              value={manualUpc}
              onChangeText={setManualUpc}
              autoFocus
              keyboardType="number-pad"
              placeholder="UPC or EAN"
              placeholderTextColor="#707084"
              style={styles.manualInput}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setManualOpen(false)} style={styles.modalSecondaryButton}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitManual} style={styles.modalPrimaryButton}>
                <Text style={styles.modalPrimaryButtonText}>Save UPC</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },
  card: {
    padding: 18,
    paddingTop: 64,
  },
  h1: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  p: {
    color: '#c9c9d1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: '#5f162d',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryText: {
    color: 'white',
    fontWeight: '800',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#171722',
    marginTop: 12,
  },
  secondaryText: {
    color: 'white',
    fontWeight: '700',
  },
  cameraWrap: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 14,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  topBarButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  title: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  smallBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  smallBtnText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  scanArea: {
    alignItems: 'center',
    gap: 20,
  },
  frame: {
    width: '86%',
    height: 160,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  toastArea: {
    alignItems: 'center',
    gap: 8,
    minHeight: 42,
  },
  toast: {
    backgroundColor: 'rgba(24, 180, 90, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastMuted: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastError: {
    backgroundColor: 'rgba(220, 60, 60, 0.85)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  help: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    paddingBottom: 18,
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.66)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#12121a',
  },
  modalTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  modalCopy: {
    color: '#c9c9d1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  manualInput: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: 'white',
    backgroundColor: '#171722',
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalPrimaryButton: {
    flex: 1,
    backgroundColor: '#5f162d',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  modalSecondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#171722',
  },
  modalSecondaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
});
