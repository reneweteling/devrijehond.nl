/**
 * Bottom tabs via the Native Tabs API (UITabBar on iOS, BottomNavigationView on
 * Android). Each trigger declares both an SF Symbol (`sf`) and a Material icon
 * (`md`) — Apple's HIG forces an icon, so every tab needs one.
 *
 * Tabs: Map (kaart) · Nabij (nearby list) · Plek toevoegen (submit) · Profiel.
 *
 * In SDK 55 `Label` and `Icon` are nested statics on the trigger
 * (`NativeTabs.Trigger.Label` / `.Icon`), not standalone named exports.
 */

import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '@/lib/theme';

const { Label, Icon } = NativeTabs.Trigger;

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.moss}>
      <NativeTabs.Trigger name="index">
        <Label>Kaart</Label>
        <Icon sf="map.fill" drawable="ic_menu_mapmode" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="nearby">
        <Label>Nabij</Label>
        <Icon sf="list.bullet" drawable="ic_menu_sort_by_size" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="add">
        <Label>Toevoegen</Label>
        <Icon sf="plus.circle.fill" drawable="ic_input_add" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>Profiel</Label>
        <Icon sf="person.crop.circle.fill" drawable="ic_menu_myplaces" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
