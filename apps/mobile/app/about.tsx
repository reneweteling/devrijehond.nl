/**
 * About De Vrije Hond. Who made it, the open-source repository (PRs + issues),
 * and how to get in touch. Reachable from the profile tab; no auth needed.
 */

import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, space } from '@/lib/theme';

const REPO = 'https://github.com/reneweteling/devrijehond.nl';

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
        paddingTop: insets.top + space.md,
        paddingBottom: insets.bottom + 40,
      }}
    >
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <SymbolView name="chevron.left" size={18} tintColor={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Over De Vrije Hond</Text>
      </View>

      <View style={styles.body}>
        <Text style={styles.lead}>
          De Vrije Hond is een community-kaart van hondvriendelijke plekken in Nederland.
          Losloopgebieden, hondenstranden, horeca en waterpunten, toegevoegd en geverifieerd door
          hondenbazen zelf.
        </Text>

        <Text style={styles.sectionLabel}>Gemaakt door</Text>
        <Text style={styles.para}>
          De Vrije Hond is gemaakt door René Weteling (Felobo B.V.), uit liefde voor honden en mooie
          wandelingen.
        </Text>

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
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.heading, fontSize: 22, lineHeight: 29, color: colors.ink, flex: 1 },
  body: { padding: space.lg, gap: space.sm },
  lead: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  sectionLabel: {
    fontFamily: font.bodyMedium,
    fontSize: 12,
    color: colors.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space.md,
  },
  para: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
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
