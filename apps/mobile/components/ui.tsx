/**
 * Small shared presentational primitives styled to the "Aarde & bos" palette.
 * Kept intentionally lightweight (pure RN views) so they hot-iterate against a
 * dev client without a native rebuild.
 */

import { type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { colors, font, radius, space } from '@/lib/theme';

export function Wordmark() {
  return (
    <View style={styles.wordmark}>
      <SymbolView name="pawprint.fill" size={16} tintColor={colors.moss} />
      <Text style={styles.wordmarkText}>De Vrije Hond</Text>
    </View>
  );
}

export function VerifiedBadge({ status }: { status: string }) {
  const verified = status === 'VERIFIED';
  return (
    <View
      style={[styles.badge, { backgroundColor: verified ? colors.mossSoft : colors.terraSoft }]}
    >
      <SymbolView
        name={verified ? 'rosette' : 'questionmark.circle.fill'}
        size={12}
        tintColor={verified ? colors.mossDark : colors.terraDark}
      />
      <Text style={[styles.badgeText, { color: verified ? colors.mossDark : colors.terraDark }]}>
        {verified ? 'Geverifieerd' : 'Niet geverifieerd'}
      </Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  icon?: SymbolViewProps['name'];
  loading?: boolean;
  disabled?: boolean;
}) {
  const bg =
    variant === 'primary' ? colors.moss : variant === 'accent' ? colors.terra : colors.surface;
  const fg = variant === 'secondary' ? colors.ink : '#fff';
  const isDisabled = disabled || loading;
  // SDK 55 / Fabric scar: the style-FUNCTION form of Pressable drops layout +
  // visual props. Keep ONLY press feedback (opacity) in the style function and
  // put all real layout / visuals on an inner View.
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({ opacity: pressed || isDisabled ? 0.6 : 1 })}
    >
      <View
        style={[
          styles.button,
          { backgroundColor: bg },
          variant === 'secondary' && styles.buttonSecondary,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon ? <SymbolView name={icon} size={16} tintColor={fg} /> : null}
            <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: SymbolViewProps['name'];
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <View style={[styles.chip, active && styles.chipActive]}>
        {icon ? (
          <SymbolView name={icon} size={12} tintColor={active ? '#fff' : colors.ink2} />
        ) : null}
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </View>
    </Pressable>
  );
}

/** A soft-moss rounded tile holding an amenity glyph. */
export function AmenityTile({
  symbol,
  label,
  highlight,
}: {
  symbol: SymbolViewProps['name'];
  label: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.amenityCol}>
      <View style={[styles.amenityTile, highlight && styles.amenityTileHi]}>
        <SymbolView name={symbol} size={20} tintColor={highlight ? '#fff' : colors.mossDark} />
      </View>
      <Text style={styles.amenityLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <SymbolView
          key={n}
          name={n <= Math.round(value) ? 'star.fill' : 'star'}
          size={size}
          tintColor={colors.terra}
        />
      ))}
    </View>
  );
}

export function ScreenTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
      <Text style={styles.screenTitle}>{children}</Text>
      {sub ? <Text style={styles.screenSub}>{sub}</Text> : null}
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <View style={styles.note}>
      <SymbolView name="info.circle.fill" size={15} tintColor={colors.mossDark} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

/**
 * Shared loading / empty / error state for lists and detail bodies. Renders the
 * first matching variant; returns null when there's nothing to say (data ready).
 */
export function ListState({
  loading,
  error,
  empty,
  emptyText = 'Niets gevonden.',
  errorText = 'Er ging iets mis bij het laden.',
  onRetry,
}: {
  loading?: boolean;
  error?: boolean;
  empty?: boolean;
  emptyText?: string;
  errorText?: string;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <View style={styles.listState}>
        <ActivityIndicator color={colors.moss} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.listState}>
        <Text style={styles.listStateText}>{errorText}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <Text style={styles.listStateRetry}>Opnieuw proberen</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.listState}>
        <Text style={styles.listStateText}>{emptyText}</Text>
      </View>
    );
  }
  return null;
}

/** Inline status banner (success / error / info), e.g. for vote + report feedback. */
export function Banner({
  kind = 'error',
  children,
  onRetry,
}: {
  kind?: 'error' | 'success' | 'info';
  children: ReactNode;
  onRetry?: () => void;
}) {
  const palette =
    kind === 'success'
      ? { bg: colors.mossSoft, fg: colors.mossDark, icon: 'checkmark.circle.fill' as const }
      : kind === 'info'
        ? { bg: colors.sand, fg: colors.ink2, icon: 'info.circle.fill' as const }
        : {
            bg: colors.terraSoft,
            fg: colors.terraDark,
            icon: 'exclamationmark.triangle.fill' as const,
          };
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg }]}>
      <SymbolView name={palette.icon} size={15} tintColor={palette.fg} />
      <Text style={[styles.bannerText, { color: palette.fg }]}>{children}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={[styles.bannerRetry, { color: palette.fg }]}>Opnieuw</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmarkText: { fontFamily: font.heading, color: colors.moss, fontSize: 16, lineHeight: 22 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  badgeText: { fontFamily: font.bodyMedium, fontSize: 11, lineHeight: 15 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 46,
    paddingHorizontal: space.lg,
    borderRadius: radius.button,
  },
  buttonSecondary: { borderWidth: 1, borderColor: colors.line },
  buttonText: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.moss, borderColor: colors.moss },
  chipText: { fontFamily: font.body, fontSize: 12, color: colors.ink2, lineHeight: 16 },
  chipTextActive: { color: '#fff' },
  amenityCol: { width: 64, alignItems: 'center', gap: 6 },
  amenityTile: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityTileHi: { backgroundColor: colors.moss },
  amenityLabel: {
    fontFamily: font.body,
    fontSize: 10,
    color: colors.ink2,
    textAlign: 'center',
  },
  screenTitle: { fontFamily: font.heading, fontSize: 24, lineHeight: 31, color: colors.ink },
  screenSub: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.ink2,
    marginTop: 2,
  },
  note: {
    flexDirection: 'row',
    gap: 9,
    margin: space.lg,
    padding: 12,
    backgroundColor: colors.sand,
    borderRadius: radius.card,
  },
  noteText: { flex: 1, fontFamily: font.body, fontSize: 12, color: colors.ink2, lineHeight: 18 },
  listState: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.xl },
  listStateText: {
    fontFamily: font.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink2,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  listStateRetry: { fontFamily: font.bodyMedium, fontSize: 13.5, color: colors.moss },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 11,
    borderRadius: radius.card,
  },
  bannerText: { flex: 1, fontFamily: font.body, fontSize: 12.5, lineHeight: 17 },
  bannerRetry: { fontFamily: font.bodyMedium, fontSize: 12.5 },
});
