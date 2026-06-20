/**
 * Word moderator — aanmeldingsformulier. Toont het huidige aanmeldingsstatus
 * als die al bestaat, anders een motivatieveld + verzendknop.
 * Auth required; unauthenticated users worden doorgestuurd naar sign-in.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { useModeratorApplication, useApplyModerator } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { colors, font, radius, space } from '@/lib/theme';
import { Banner, Button, ListState } from '@/components/ui';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'In behandeling',
  APPROVED: 'Goedgekeurd',
  REJECTED: 'Afgewezen',
};

export default function ModeratorApplyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const qc = useQueryClient();
  const { status, isAuthenticated } = useAuth();

  useEffect(() => {
    if (status !== 'loading' && !isAuthenticated) router.replace('/(auth)/sign-in');
  }, [status, isAuthenticated, router]);

  const {
    data: application,
    isLoading: appLoading,
    isError: appError,
    refetch,
  } = useModeratorApplication(isAuthenticated);

  const apply = useApplyModerator();
  const [motivation, setMotivation] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (status === 'loading' || !isAuthenticated) return <ListState loading />;

  if (appLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <Header onBack={() => router.back()} />
        <ListState loading />
      </View>
    );
  }

  if (appError) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
        <Header onBack={() => router.back()} />
        <ListState error errorText="Kon aanmelding niet laden." onRetry={() => void refetch()} />
      </View>
    );
  }

  const onSubmit = () => {
    if (motivation.trim().length < 10) return;
    apply.mutate(
      { motivation: motivation.trim() },
      {
        onSuccess: () => {
          setSubmitted(true);
          void qc.invalidateQueries({ queryKey: ['moderator-application'] });
        },
      },
    );
  };

  // Existing application (or just submitted via 409 path)
  const existing = application;

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md }]}>
      <Header onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <SymbolView name="shield.fill" size={28} tintColor={colors.mossDark} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.heroTitle}>Word moderator</Text>
            <Text style={styles.heroSub}>
              Help de community door plekken te controleren en meldingen te behandelen.
            </Text>
          </View>
        </View>

        {submitted || existing ? (
          <StatusCard application={existing ?? null} justSubmitted={submitted} />
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <Text style={styles.label}>Motivatie</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={motivation}
                onChangeText={setMotivation}
                placeholder="Vertel waarom je moderator wilt worden en wat je bijdrage kan zijn (minimaal 10 tekens)."
                placeholderTextColor={colors.ink3}
                multiline
                maxLength={1000}
                autoCapitalize="sentences"
              />
              <Text style={styles.charCount}>{motivation.trim().length} / 1000</Text>
            </View>

            {apply.isError ? (
              <Banner kind="error">
                {(apply.error as { status?: number } | null)?.status === 409
                  ? 'Je hebt al een aanmelding ingediend.'
                  : 'Aanmelding mislukt. Probeer opnieuw.'}
              </Banner>
            ) : null}

            <Button
              label="Aanmelden als moderator"
              onPress={onSubmit}
              loading={apply.isPending}
              disabled={motivation.trim().length < 10}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={10}>
        <SymbolView name="chevron.left" size={20} tintColor={colors.ink} />
      </Pressable>
      <Text style={styles.headerTitle}>Word moderator</Text>
      <View style={{ width: 20 }} />
    </View>
  );
}

function StatusCard({
  application,
  justSubmitted,
}: {
  application: { id: string; status: string; motivation: string; createdAt: string } | null;
  justSubmitted: boolean;
}) {
  const isPending = !application || application.status === 'PENDING';
  const isApproved = application?.status === 'APPROVED';

  return (
    <View style={styles.statusCard}>
      <View style={styles.statusRow}>
        <SymbolView
          name={isApproved ? 'checkmark.seal.fill' : 'clock.fill'}
          size={18}
          tintColor={isApproved ? colors.mossDark : colors.terra}
        />
        <Text style={[styles.statusLabel, { color: isApproved ? colors.mossDark : colors.terra }]}>
          {application
            ? (STATUS_LABELS[application.status] ?? application.status)
            : 'In behandeling'}
        </Text>
      </View>

      {justSubmitted && isPending ? (
        <Banner kind="success">
          Je aanmelding is ontvangen. We laten je weten zodra er een beslissing is.
        </Banner>
      ) : null}

      {application?.motivation ? (
        <View style={{ gap: 4 }}>
          <Text style={styles.motLabel}>Jouw motivatie</Text>
          <Text style={styles.motText}>{application.motivation}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  headerTitle: { fontFamily: font.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: space.lg,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.mossSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontFamily: font.heading, fontSize: 15, lineHeight: 20, color: colors.ink },
  heroSub: { fontFamily: font.body, fontSize: 12, color: colors.ink2, lineHeight: 18 },
  label: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#fff',
  },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  charCount: { fontFamily: font.body, fontSize: 11, color: colors.ink3, textAlign: 'right' },
  statusCard: {
    backgroundColor: colors.sand,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusLabel: { fontFamily: font.bodyMedium, fontSize: 14 },
  motLabel: { fontFamily: font.bodyMedium, fontSize: 12, color: colors.ink2 },
  motText: { fontFamily: font.body, fontSize: 13, color: colors.ink, lineHeight: 20 },
});
