import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Button } from './ui';
import { colors, font, space } from '@/lib/theme';

/**
 * Full-screen, non-dismissable gate shown when the app version is below the
 * server's minimum supported version (see lib/app-version). Sends the user to
 * the right store.
 */
export function ForceUpdate({ url }: { url: { ios: string; android: string } }) {
  const open = () => {
    void Linking.openURL(Platform.OS === 'ios' ? url.ios : url.android);
  };

  return (
    <View style={styles.root}>
      <SymbolView name="arrow.up.circle.fill" size={56} tintColor={colors.moss} />
      <Text style={styles.title}>Tijd voor een update</Text>
      <Text style={styles.sub}>
        Je gebruikt een oude versie van De Vrije Hond. Werk de app bij om verder te kunnen.
      </Text>
      <View style={styles.btn}>
        <Button label="App bijwerken" icon="arrow.down.app.fill" onPress={open} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: 40,
  },
  title: {
    fontFamily: font.heading,
    fontSize: 22,
    lineHeight: 29,
    color: colors.ink,
    marginTop: space.sm,
  },
  sub: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.ink2,
    textAlign: 'center',
    lineHeight: 21,
  },
  btn: { width: '100%', paddingHorizontal: space.xl, marginTop: space.md },
});
