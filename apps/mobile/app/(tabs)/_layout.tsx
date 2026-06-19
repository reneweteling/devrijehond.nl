/**
 * Bottom tabs via the Native Tabs API (UITabBar on iOS, BottomNavigationView on
 * Android). Each trigger declares both an SF Symbol (`sf`) and a Material icon
 * (`md`) — Apple's HIG forces an icon, so every tab needs one.
 *
 * Tabs: Map (kaart) · Nabij (nearby list) · Plek toevoegen (submit) · Profiel.
 *
 * TODO(verify): `expo-router/unstable-native-tabs` is the SDK-55 import path for
 * the native-tabs API; confirm the `NativeTabs` / `NativeTabs.Trigger` /
 * `Icon` / `Label` subcomponent names against the installed expo-router build —
 * the unstable API has churned across SDKs. If the import is unavailable, fall
 * back to `import { Tabs } from 'expo-router'` with `tabBarIcon` rendering an
 * `expo-symbols` SymbolView.
 */

import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

import { colors } from '@/lib/theme';

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
