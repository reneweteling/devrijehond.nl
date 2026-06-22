/**
 * About De Vrije Hond. Who made it, the open-source repository (PRs + issues),
 * and how to get in touch. Reachable from the profile tab; no auth needed.
 */

import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, space } from '@/lib/theme';

const REPO = 'https://github.com/reneweteling/devrijehond.nl';
const APP_ICON = require('@/assets/icon.png');

function Row({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <SymbolView name={icon} size={18} tintColor={colors.mossDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <SymbolView name="arrow.up.right" size={14} tintColor={colors.ink3} />
    </Pressable>
  );
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + space.sm,
        paddingBottom: insets.bottom + 40,
      }}
    >
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <SymbolView name="chevron.left" size={18} tintColor={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Image source={APP_ICON} style={styles.heroIcon} resizeMode="cover" />
        <View style={styles.brandRow}>
          <SymbolView name="pawprint.fill" size={15} tintColor={colors.moss} />
          <Text style={styles.brandText}>De Vrije Hond</Text>
        </View>
        <Text style={styles.title}>Over De Vrije Hond</Text>
        <Text style={styles.lead}>
          Een community-kaart van hondvriendelijke plekken in Nederland. Losloopgebieden,
          hondenstranden, horeca en waterpunten, toegevoegd en geverifieerd door hondenbazen zelf.
        </Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>Gemaakt door</Text>
        <Text style={styles.para}>
          De Vrije Hond is gemaakt door René Weteling (Felobo B.V.), uit liefde voor honden en mooie
          wandelingen. Van idee tot productie: web, mobiel en AI.
        </Text>
        <Row
          icon="globe"
          title="weteling.com"
          sub="Mijn website"
          onPress={() => Linking.openURL('https://www.weteling.com')}
        />

        <Text style={styles.sectionLabel}>Open source, bouw mee</Text>
        <Text style={styles.para}>
          De code is openbaar. Heb je een idee of vind je een bug? Je bent welkom om mee te bouwen.
        </Text>
        <Row
          icon="chevron.left.forwardslash.chevron.right"
          title="Bekijk de code"
          sub="github.com/reneweteling/devrijehond.nl"
          onPress={() => Linking.openURL(REPO)}
        />
        <Row
          icon="arrow.triangle.branch"
          title="Open een pull request"
          sub="Stel een verbetering voor"
          onPress={() => Linking.openURL(`${REPO}/pulls`)}
        />
        <Row
          icon="exclamationmark.bubble"
          title="Maak een issue aan"
          sub="Meld een bug of idee"
          onPress={() => Linking.openURL(`${REPO}/issues/new`)}
        />

        <Text style={styles.sectionLabel}>Contact</Text>
        <Row
          icon="envelope"
          title="info@devrijehond.nl"
          sub="Vragen, samenwerken of hallo zeggen"
          onPress={() => Linking.openURL('mailto:info@devrijehond.nl')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.sand },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    height: 44,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.lg,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.mossSoft,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.md,
  },
  brandText: {
    fontFamily: font.heading,
    color: colors.moss,
    fontSize: 15,
    lineHeight: 20,
  },
  title: {
    fontFamily: font.heading,
    fontSize: 26,
    lineHeight: 33,
    color: colors.ink,
    marginTop: 2,
  },
  lead: {
    fontFamily: font.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink2,
    marginTop: space.sm,
  },
  body: { paddingHorizontal: space.lg, paddingBottom: space.lg, gap: space.sm },
  sectionLabel: {
    fontFamily: font.bodyMedium,
    fontSize: 12,
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space.lg,
  },
  para: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 6,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontFamily: font.bodyMedium, fontSize: 14.5, color: colors.ink },
  rowSub: { fontFamily: font.body, fontSize: 12.5, color: colors.ink2, marginTop: 1 },
});
