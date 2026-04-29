import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/auth';

export default function IndexScreen() {
  const { ready, session, startupError } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>CD Valet</Text>
      <Text style={styles.h1}>Your library starts here</Text>
      <Text style={styles.p}>
        CD Valet opens immediately on a clean install so any collector can start building a personal CD library, even without a network connection.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ready to start</Text>
        <Text style={styles.statusLine}>
          {ready ? 'Local startup finished.' : 'Preparing local library in the background...'}
        </Text>
        {startupError ? <Text style={styles.errorText}>{startupError}</Text> : null}
        <Text style={styles.emptyHeadline}>Scan your first CD</Text>
        <Text style={styles.emptyCopy}>
          No account or invitation is required. Open the scanner and start building your personal music collection right away.
        </Text>

        <View style={styles.actionRow}>
          <Link href="/(tabs)/scan" asChild>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{session ? 'Continue scanning' : 'Scan your CDs now'}</Text>
            </Pressable>
          </Link>

          <Link href="/(tabs)/library" asChild>
            <Pressable style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Open empty library</Text>
            </Pressable>
          </Link>

          {!session ? (
            <Link href="/sign-in" asChild>
              <Pressable style={styles.tertiaryButton}>
                <Text style={styles.tertiaryButtonText}>Save an optional local profile</Text>
              </Pressable>
            </Link>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    paddingHorizontal: 20,
    paddingTop: 72,
  },
  eyebrow: {
    color: '#f7e7b1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  h1: {
    color: 'white',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 12,
  },
  p: {
    color: '#c9c9d1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  card: {
    borderWidth: 1,
    borderColor: '#242431',
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#12121a',
  },
  sectionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  statusLine: {
    color: '#c9c9d1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  errorText: {
    color: '#ff9a9a',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  emptyHeadline: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyCopy: {
    color: '#c9c9d1',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  actionRow: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#5f162d',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#2d2d3e',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: '#171722',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tertiaryButton: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  tertiaryButtonText: {
    color: '#f7e7b1',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
