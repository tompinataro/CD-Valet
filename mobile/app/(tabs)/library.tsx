import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useFocusEffect } from 'expo-router';

import { createManualCd, updateCdDetails, type CdLibraryItem } from '../../src/db';
import { useCdLibrary } from '../../src/hooks/useCdLibrary';

const SAMPLE_CDS = [
  { id: 'sample-1', title: 'Midnight Sessions', format: 'CD', note: 'Example album preview' },
  { id: 'sample-2', title: 'Greatest Hits Collection', format: 'Box Set', note: 'Example library card' },
  { id: 'sample-3', title: 'Sunday Road Mix', format: 'Album', note: 'Appears here after scanning' },
];

type EditForm = {
  artist: string;
  albumTitle: string;
  format: string;
  notes: string;
};

function toForm(item: CdLibraryItem): EditForm {
  return {
    artist: item.artist ?? '',
    albumTitle: item.album_title ?? '',
    format: item.format || 'CD',
    notes: item.notes ?? '',
  };
}

export default function LibraryScreen() {
  const { items, loading, error, refresh } = useCdLibrary();
  const [showIntro, setShowIntro] = useState(true);
  const [editingItem, setEditingItem] = useState<CdLibraryItem | null>(null);
  const [form, setForm] = useState<EditForm>({ artist: '', albumTitle: '', format: 'CD', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const shouldShowEmptyState = useMemo(() => !loading && items.length === 0, [items.length, loading]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  function openEditor(item: CdLibraryItem) {
    setEditingItem(item);
    setForm(toForm(item));
    setSaveError(null);
  }

  async function saveEditor() {
    if (!editingItem) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateCdDetails({ upc: editingItem.upc, ...form });
      setEditingItem(null);
      await refresh();
    } catch (error: any) {
      setSaveError(String(error?.message || error));
    } finally {
      setSaving(false);
    }
  }

  async function addManualCd() {
    setSaveError(null);
    const item = await createManualCd();
    await refresh();
    openEditor(item);
  }

  if (editingItem) {
    return (
      <View style={styles.editorScreen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editorCard}>
          <Text style={styles.modalEyebrow}>CD Details</Text>
          <Text style={styles.editorTitle}>{editingItem.upc}</Text>
          <View style={styles.editorTopActions}>
            <Pressable onPress={saveEditor} disabled={saving} style={[styles.editorSaveButton, saving && styles.disabledButton]}>
              <Text style={styles.modalPrimaryButtonText}>{saving ? 'Saving...' : 'Save CD'}</Text>
            </Pressable>
            <Pressable onPress={() => setEditingItem(null)} style={styles.editorCancelButton}>
              <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Album</Text>
          <TextInput
            value={form.albumTitle}
            onChangeText={(albumTitle) => setForm((current) => ({ ...current, albumTitle }))}
            placeholder="Album title"
            placeholderTextColor="#707084"
            style={styles.input}
          />

          <Text style={styles.label}>Artist</Text>
          <TextInput
            value={form.artist}
            onChangeText={(artist) => setForm((current) => ({ ...current, artist }))}
            placeholder="Artist or group"
            placeholderTextColor="#707084"
            style={styles.input}
          />

          <Text style={styles.label}>Format</Text>
          <View style={styles.formatRow}>
            {['CD', 'Box Set', 'Single'].map((format) => (
              <Pressable
                key={format}
                onPress={() => setForm((current) => ({ ...current, format }))}
                style={[styles.formatChoice, form.format === format && styles.formatChoiceActive]}
              >
                <Text style={[styles.formatChoiceText, form.format === format && styles.formatChoiceTextActive]}>
                  {format}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={form.notes}
            onChangeText={(notes) => setForm((current) => ({ ...current, notes }))}
            placeholder="Condition, edition, shelf, or anything worth remembering"
            placeholderTextColor="#707084"
            style={[styles.input, styles.notesInput]}
            multiline
          />

          {saveError ? <Text style={styles.error}>{saveError}</Text> : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Modal
        transparent
        animationType="fade"
        visible={showIntro && shouldShowEmptyState}
        onRequestClose={() => setShowIntro(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>CD Valet Tip</Text>
            <Text style={styles.modalTitle}>Your CD library contents will appear here</Text>
            <Text style={styles.modalCopy}>
              Scan UPCs first, then add album, artist, format, and notes from the Library tab.
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowIntro(false)} style={styles.modalSecondaryButton}>
                <Text style={styles.modalSecondaryButtonText}>Got it</Text>
              </Pressable>
              <Link href="/(tabs)/scan" asChild>
                <Pressable style={styles.modalPrimaryButton}>
                  <Text style={styles.modalPrimaryButtonText}>Open scanner</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.h1}>CD Library</Text>
          <Text style={styles.count}>{items.length} saved</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={addManualCd} style={styles.addBtn}>
            <Text style={styles.addText}>Add CD</Text>
          </Pressable>
          <Pressable onPress={refresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.p}>
        Scan a UPC, then tap a library row to add the album, artist, format, and notes.
      </Text>
      {loading ? <Text style={styles.status}>Checking your local library...</Text> : null}
      {error ? <Text style={[styles.status, styles.error]}>{error}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(it) => it.upc}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const title = item.album_title || 'Unidentified CD';
          const artist = item.artist || 'Tap to add artist';

          return (
            <Pressable onPress={() => openEditor(item)} style={styles.row}>
              <View style={styles.rowTop}>
                <View style={styles.formatBadge}>
                  <Text style={styles.formatBadgeText}>{item.format || 'CD'}</Text>
                </View>
                <Text style={styles.meta}>last scanned: {item.last_scanned_at.slice(0, 19).replace('T', ' ')}</Text>
              </View>
              <Text style={styles.albumTitle}>{title}</Text>
              <Text style={styles.artist}>{artist}</Text>
              <Text style={styles.upc}>{item.upc.startsWith('manual-') ? 'Manual entry' : `UPC ${item.upc}`}</Text>
              {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your library is empty</Text>
            <Text style={styles.emptyCopy}>
              Add your first CD to start building your collection. You can open the scanner now, even if the device is offline and before saving any profile.
            </Text>
            <Link href="/(tabs)/scan" asChild>
              <Pressable style={styles.primaryCta}>
                <Text style={styles.primaryCtaText}>Add your first CD</Text>
              </Pressable>
            </Link>
            <Pressable onPress={addManualCd} style={styles.secondaryCta}>
              <Text style={styles.secondaryCtaText}>Enter one manually</Text>
            </Pressable>

            <View style={styles.sampleSection}>
              <Text style={styles.sampleHeading}>Sample library preview</Text>
              {SAMPLE_CDS.map((sample) => (
                <View key={sample.id} style={styles.sampleCard}>
                  <View style={styles.sampleBadge}>
                    <Text style={styles.sampleBadgeText}>Example</Text>
                  </View>
                  <Text style={styles.sampleTitle}>{sample.title}</Text>
                  <Text style={styles.sampleMeta}>
                    {sample.format} · {sample.note}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    padding: 16,
  },
  editorScreen: {
    flex: 1,
    backgroundColor: '#12121a',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.66)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  editorBackdrop: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    justifyContent: 'flex-start',
  },
  editorScroll: {
    flex: 1,
  },
  modalCard: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 20,
    padding: 20,
    backgroundColor: '#12121a',
  },
  editorCard: {
    flexGrow: 1,
    borderTopWidth: 0,
    borderColor: '#2d2d3e',
    padding: 20,
    paddingTop: 64,
    paddingBottom: 30,
    backgroundColor: '#12121a',
  },
  modalEyebrow: {
    color: '#f7e7b1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  editorTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  editorTopActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  editorSaveButton: {
    flex: 1,
    backgroundColor: '#5f162d',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editorCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#171722',
  },
  modalCopy: {
    color: '#c9c9d1',
    fontSize: 14,
    lineHeight: 21,
  },
  modalActions: {
    gap: 10,
    marginTop: 18,
  },
  modalPrimaryButton: {
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
  disabledButton: {
    opacity: 0.7,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  h1: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
  count: {
    color: '#9a9ab0',
    fontSize: 12,
    marginTop: 4,
  },
  p: {
    color: '#c9c9d1',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 21,
  },
  status: {
    color: '#9a9ab0',
    fontSize: 13,
    marginBottom: 10,
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addBtn: {
    backgroundColor: '#5f162d',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  addText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  refreshText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: 10,
    paddingBottom: 24,
    flexGrow: 1,
  },
  row: {
    borderWidth: 1,
    borderColor: '#242431',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#12121a',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  formatBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#2b2032',
  },
  formatBadgeText: {
    color: '#f7e7b1',
    fontSize: 11,
    fontWeight: '800',
  },
  albumTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  artist: {
    color: '#c9c9d1',
    fontSize: 14,
    marginBottom: 10,
  },
  upc: {
    color: '#9a9ab0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: '#9a9ab0',
    fontSize: 12,
  },
  notes: {
    color: '#c9c9d1',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  label: {
    color: '#9a9ab0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 12,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: 'white',
    backgroundColor: '#171722',
  },
  notesInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  formatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  formatChoice: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#171722',
  },
  formatChoiceActive: {
    borderColor: '#f7e7b1',
    backgroundColor: '#2b2032',
  },
  formatChoiceText: {
    color: '#c9c9d1',
    fontSize: 12,
    fontWeight: '700',
  },
  formatChoiceTextActive: {
    color: '#f7e7b1',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#242431',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#12121a',
    marginTop: 4,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyCopy: {
    color: '#c9c9d1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  primaryCta: {
    backgroundColor: '#5f162d',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryCtaText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryCta: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#171722',
  },
  secondaryCtaText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  sampleSection: {
    marginTop: 18,
    gap: 10,
  },
  sampleHeading: {
    color: '#f7e7b1',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  sampleCard: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#171722',
  },
  sampleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#2b2032',
    marginBottom: 8,
  },
  sampleBadgeText: {
    color: '#f7e7b1',
    fontSize: 11,
    fontWeight: '700',
  },
  sampleTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sampleMeta: {
    color: '#9a9ab0',
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: '#ff9a9a',
  },
});
