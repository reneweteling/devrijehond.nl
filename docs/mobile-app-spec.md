# De Vrije Hond, mobiele app: feature- en contractspec

Status: levend document, bijgewerkt 2026-06-24.

Dit is de canonieke, framework-onafhankelijke spec van de mobiele app. Het is
geschreven als blauwdruk voor een **Flutter-POC** (eigen branch, zie onderaan),
maar geldt net zo goed voor de bestaande Expo-app (`apps/mobile`) en de native
SwiftUI-app (`apps/ios-native`, branch `native-ios-spike`).

De drie clients praten met exact dezelfde backend. De client-laag is dus
vervangbaar; de API, auth en datacontracten hieronder veranderen niet als je van
framework wisselt.

## 0. Architectuur in één alinea

De backend is de Next.js-app onder `apps/web`, die zowel de publieke site als de
API serveert. Productie-origin voor zowel API als auth: `https://api.devrijehond.nl`
(dev: `https://api-dev.devrijehond.nl`). De mobiele client raakt **nooit** de
database; alle data loopt via HTTP. Publieke reads (`/api/v1/...`) zijn anoniem en
CDN-cachebaar; persoonlijke calls (`/api/v1/me/...`) vereisen een bearer-token en
zijn no-store. Auth loopt via BetterAuth onder `/api/auth/...`.

Kernmodel (community-verificatie): een plek wordt direct gepubliceerd als
`UNVERIFIED`. Stemmen zijn gewogen naar reputatie. `netScore >= +5` → `VERIFIED`;
`denyCount >= 3` → `HIDDEN` (verbergen wint als beide vuren). Drempels staan in
`apps/web/.../lib/verification.ts`.

---

## 1. Feature-inventaris per gebied

Legenda gating: `pub` = anoniem, `auth` = ingelogd, `owner` = eigenaar van de
resource, `mod` = moderator/admin.

### 1.1 Auth en sessie

- Inloggen met **magic link** (e-mail) `pub`
- Inloggen met **Apple** (native) `pub`, alleen iOS
- Inloggen met **Google** (native) `pub`, iOS + Android
- "Check je inbox"-bevestigingsstaat na magic link
- Magic-link verifiëren via deep link `vrijehond://verify?token=...`
- Uitloggen (lokaal: token wissen; geen server sign-out nodig) `auth`
- Sessiepersistentie (Keychain/Keystore), boot-verificatie, sliding refresh
- 401 op een geauthenticeerde call → terugvallen naar anoniem
- Anonymous-first: uitgelogd start je gewoon op de kaart, nooit een gedwongen login
- (Expo heeft ook) Force-update-gate via `GET /api/v1/app-config`

### 1.2 Kaart en ontdekken

- Native kaart met markers, clusters (server-side), regio-polygonen
- POI-markers druppelvorm, verificatie-gestyled (geverifieerd vs niet)
- Regio-geofence-polygonen + centrumstip
- Clusters: tik om in te zoomen/splitsen; grootte schaalt met aantal
- Tik op marker → detail (sheet of scherm)
- Categorie-filter (chips). Let op: filter **server-side** meegeven, niet client-side
  na clustering (anders verdwijnt alles bij uitzoomen, zie §6)
- Zoeken: plekken (in onze gids) + adressen/plaatsen via geocoder
- Locatie-knop (recenter), satelliet/standaard-toggle, blauwe gebruikerstip
- Legenda geverifieerd/niet-geverifieerd
- Nabij-lijst: dichtstbij eerst, thumbnails, afstand, categorie-filter, zoeken,
  pull-to-refresh

### 1.3 Spot-detail en acties

- Hero-foto (met fallback-placeholder), titel, categorie, verified-badge, rating
- Beschrijving (rich text, HTML-subset; minimaal strip-tags)
- Mini-kaart: POI-marker of regio-polygon (niet-interactief)
- Community-check-blok: status + voortgang (netScore/5) + bevestigd/afgewezen
- Stemmen: **Klopt** (CONFIRM) / **Klopt niet** (DENY) met proximity-proof `auth`
- Voorzieningen (amenities) als chips
- POI-info: adres (open in kaarten-app), telefoon, website, openingstijden
- Reviews: lijst (auteur, sterren, datum, tekst, "N× nuttig") + zelf schrijven `auth`
- Probleem melden (report) met reden-picker `auth`
- Moderatie-kaart (verifieer/herstel/verberg/verwijder) `mod`
- Gating: niet stemmen op je eigen plek; stem-UI alleen bij `UNVERIFIED`

### 1.4 Plek toevoegen / bewerken

- Type kiezen: **Gebied** (REGION, polygon) of **Plek** (POI, punt) `auth`
- Geometrie-editor (zie §6, het kernpijnpunt van dit hele traject):
  - POI: punt neerzetten
  - REGION: punten toevoegen, hoekpunt slepen/verplaatsen, wis laatste/alles
- Detailformulier: naam, categorie (gefilterd op type), beschrijving, amenities
  (gefilterd op categorie), foto's, en voor POI ook adres/website
- Foto-upload (los endpoint, dan URL's meesturen)
- Indienen → plek verschijnt direct als niet-geverifieerd
- Mijn inzendingen (eigen plekken) `auth`
- (Nog niet in Expo of native) eigen plek bewerken/verwijderen, zie §7

### 1.5 Profiel, honden, account

- Profiel bekijken: avatar, naam, @handle, bio, reputatie, rol-badge `auth`
- Profiel bewerken: naam, handle, bio, **avatar uploaden** `auth`
- Honden CRUD: toevoegen/bewerken/verwijderen, naam, ras, geboortedatum, foto,
  notitie `owner`
- Moderator-aanmelding (motivatie) + status (pending/approved/rejected) `auth`
- Over De Vrije Hond (externe links, versie)
- Uitloggen
- (Expo) Feedback via Sentry-widget

### 1.6 Wensen (feature requests)

- Lijst met statusfilter (Populair/In overweging/Gepland/Klaar/Afgewezen)
- Kaart per wens: titel, body, component-tag, upvote-aantal
- Nieuw verzoek aanmaken (titel, body, component) `auth`
- Detail + upvote (optimistisch togglen) `auth`

---

## 2. API-contract (de kern voor implementatie)

Alle bodies/responses zijn JSON. Foutformaat overal:
`{ "error": "UPPER_SNAKE_CODE", "message": "...", "details"?: ... }`.
Stuur op elke call `X-API-Version: v1` mee. `/me/*` is no-store.
Geauthenticeerd = header `Authorization: Bearer <token>`.

### 2.1 Auth (BetterAuth, onder /api/auth)

| Doel                  | Methode + pad                               | Body                                           | Respons                                                           |
| --------------------- | ------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------- |
| Apple native          | `POST /api/auth/mobile/apple-native`        | `{ idToken }`                                  | `{ token, expiresAt }`                                            |
| Google native         | `POST /api/auth/mobile/google-native`       | `{ idToken }`                                  | `{ token, expiresAt }`                                            |
| Magic link aanvragen  | `POST /api/auth/sign-in/magic-link`         | `{ email, callbackURL: "vrijehond://verify" }` | 200 (429 = rate limited)                                          |
| Magic link verifiëren | `GET /api/auth/magic-link/verify?token=...` | —                                              | bearer in **`set-auth-token`** response-header (volg de 302 NIET) |
| Sessie checken        | `GET /api/auth/get-session`                 | bearer                                         | sessie                                                            |

- `token` is een **getekend BetterAuth session-token** (`<raw>.<hmac>`), niet de
  ruwe DB-sessie. Bewaar in Keychain/Keystore.
- Apple: de idToken-`aud` moet de bundle id `nl.devrijehond.app` zijn (server
  checkt `APPLE_BUNDLE_ID`). Geen client secret nodig op het native pad.
- Google: de idToken-`aud` moet de **WEB** OAuth client id zijn. De native SDK
  configureer je met de iOS client id + `serverClientID` = de web client id.
  - iOS client id: `762592672284-8atreoupa0ic702gnrg61bds9h88qrmp.apps.googleusercontent.com`
  - Web client id (de `aud`): `762592672284-cr47iv5jq6d0p2ghvmrcrf1lar90vpiq.apps.googleusercontent.com`
  - Reversed iOS id (URL scheme): `com.googleusercontent.apps.762592672284-8atreoupa0ic702gnrg61bds9h88qrmp`
- Account-linking: een bestaande magic-link-gebruiker met hetzelfde geverifieerde
  e-mailadres wordt automatisch gekoppeld aan Apple/Google.

### 2.2 Publieke reads (/api/v1, anoniem)

| Doel          | Methode + pad                      | Belangrijkste params/vorm                                                                                                                                                                                 |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kaart-data    | `GET /api/v1/spots/map`            | `minLng,minLat,maxLng,maxLat`, `cluster=true`, optioneel `categoryId`, `type`. Respons `{ items: SpotSummary[], clusters: {lat,lng,count}[] }`. `items[].geometry` = GeoJSON Point of Polygon ([lng,lat]) |
| Lijst / nabij | `GET /api/v1/spots`                | `nearLat,nearLng,limit`. Respons `{ items: SpotSummary[], nextCursor }`                                                                                                                                   |
| Detail        | `GET /api/v1/spots/{slug}`         | Respons SpotDetail (incl. `submittedBy`, `geometry`, `amenities`, `photos`, `verification`)                                                                                                               |
| Reviews       | `GET /api/v1/spots/{slug}/reviews` | Respons `{ items: Review[], nextCursor }`                                                                                                                                                                 |
| Categorieën   | `GET /api/v1/categories`           | `{ items: Category[] }`; `Category.type` = `POI` of `REGION`                                                                                                                                              |
| Amenities     | `GET /api/v1/amenities`            | optioneel `?categoryId=`; `{ items: Amenity[] }`                                                                                                                                                          |
| Wensen        | `GET /api/v1/feature-requests`     | optioneel `?status=`; `{ items: FeatureRequest[], nextCursor }`                                                                                                                                           |
| Geocode       | `GET /api/v1/geocode?q=`           | `{ items: { label, lat, lng }[] }` (min 2 tekens)                                                                                                                                                         |
| App-config    | `GET /api/v1/app-config`           | `{ minSupportedVersion, latestVersion, storeUrls }`                                                                                                                                                       |

### 2.3 Geauthenticeerd (/api/v1/me, bearer verplicht)

| Doel               | Methode + pad                                | Body                                                        | Respons                                                                       |
| ------------------ | -------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Profiel            | `GET /api/v1/me`                             | —                                                           | MeProfile                                                                     |
| Profiel bewerken   | `PATCH /api/v1/me`                           | `{ name?, handle?, bio?, image? }`                          | MeProfile                                                                     |
| Mijn plekken       | `GET /api/v1/me/spots`                       | —                                                           | `{ items: SpotSummary[] }`                                                    |
| Plek aanmaken      | `POST /api/v1/me/spots`                      | SubmitSpot (zie §2.5)                                       | 201 SpotDetail                                                                |
| Stemmen            | `POST /api/v1/me/spots/{id}/vote`            | `{ value: "CONFIRM"\|"DENY", proof?: {lat,lng} }`           | `{ vote, netScore, confirmCount, denyCount, status }`                         |
| Review plaatsen    | `POST /api/v1/me/spots/{id}/reviews`         | `{ stars: 0..5, body? }`                                    | Review                                                                        |
| Modereren          | `PATCH /api/v1/me/spots/{id}/moderate`       | `{ status: "VERIFIED"\|"UNVERIFIED"\|"HIDDEN"\|"REMOVED" }` | `{ ok: true }`                                                                |
| Report             | `POST /api/v1/me/reports`                    | `{ targetType: "SPOT", targetId, reason, note? }`           | `{ id, createdAt }`                                                           |
| Honden ophalen     | `GET /api/v1/me/dogs`                        | —                                                           | `{ items: Dog[] }`                                                            |
| Hond aanmaken      | `POST /api/v1/me/dogs`                       | CreateDog (zie §2.5)                                        | 201 Dog                                                                       |
| Hond bewerken      | `PATCH /api/v1/me/dogs/{id}`                 | partial CreateDog                                           | Dog                                                                           |
| Hond verwijderen   | `DELETE /api/v1/me/dogs/{id}`                | —                                                           | 204                                                                           |
| Foto upload        | `POST /api/v1/me/uploads`                    | multipart, veld **`file`** (image/jpeg)                     | `{ publicUrl, key }`                                                          |
| Wens aanmaken      | `POST /api/v1/me/feature-requests`           | `{ title(4..140), body?, component? }`                      | FeatureRequest                                                                |
| Wens upvote        | `POST /api/v1/me/feature-requests/{id}/vote` | —                                                           | `{ requestId, upvoteCount, viewerHasVoted }`                                  |
| Moderator-aanvraag | `GET/POST /api/v1/me/moderator-application`  | POST `{ motivation(>=10) }`                                 | `{ id, status, motivation, createdAt }` (GET: `{ application: ... \| null }`) |

Report-redenen: `DUPLICATE`, `WRONG_INFO`, `SPAM`, `INAPPROPRIATE`, `OTHER`.
Wens-statussen: `CONSIDERING`, `PLANNED`, `DONE`, `DECLINED` ("Populair" = geen filter).

### 2.4 Belangrijkste responsevormen

- **SpotSummary**: `{ id, slug, type, name, categoryId, status, lat?, lng?, rating:{average,count}, photoUrl?, geometry? }`
- **SpotDetail**: SpotSummary-velden + `description?, category(volledig), address?, phone?, website?, hours?, amenities[], photos[{url,...}], verification{status,netScore,confirmCount,denyCount,verifiedAt}, submittedBy{id,handle?,name?,image?}, createdAt, updatedAt`
- **MeProfile**: `{ id, email, name?, handle?, bio?, image?, role("USER"\|"MODERATOR"\|"ADMIN"), reputation:int, dogs: Dog[], createdAt }`
- **Dog**: `{ id, name, breed?, birthYear?, birthDate?("YYYY-MM-DD"), photoUrl?, note?, createdAt, updatedAt }`
- **Review**: `{ id, spotId, stars, body?, helpfulCount, author{id,handle?,name?,image?}, createdAt }`
- **FeatureRequest**: `{ id, title, body?, component?, status, upvoteCount, viewerHasVoted, author{handle?,image?}, createdAt }`
- **Category**: `{ id, slug, label, type, icon?, color? }`
- **Amenity**: `{ id, slug, label, icon?, sortOrder, categoryIds[] }`

### 2.5 SubmitSpot en CreateDog (validatie)

SubmitSpot body:

```
{
  type: "POI" | "REGION",          // verplicht
  categoryId: uuid,                // verplicht, uit /categories
  name: string (2..120),           // verplicht
  description?: string (<=4000),
  point?:   { lat, lng },          // POI: precies één van point|polygon
  polygon?: [{ lat, lng }, ...],   // REGION: >=3 punten (ring wordt server-side gesloten)
  amenityIds?: uuid[],
  photos?: string[] (<=10, publicUrl's uit /me/uploads),
  address?, phone?, website?       // alleen POI; voor REGION genegeerd
}
```

CreateDog body: `{ name(1..60), breed?(<=80), birthDate?("YYYY-MM-DD"), birthYear?(1990..nu), photoUrl?, note?(<=500) }`.

---

## 3. Auth-flows in detail

**Apple (iOS):** systeem-sheet → `identityToken` (JWT) → `POST .../apple-native {idToken}`
→ bewaar `token`. Vereist de capability/entitlement "Sign in with Apple" op de
App ID en in de gesignde binary (zie §6, build-valkuil).

**Google (iOS + Android):** native SDK met iOS client id + serverClientID = web id
→ `idToken` → `POST .../google-native {idToken}` → bewaar `token`. Registreer de
reversed-iOS-id als URL scheme.

**Magic link:** `POST .../sign-in/magic-link {email, callbackURL:"vrijehond://verify"}`.
De server herschrijft de e-maillink naar een HTTPS-interstitial `/verify-mobile`
(want mailclients strippen niet-HTTP(S)-links), die doorlinkt naar
`vrijehond://verify?token=...`. App opent via die deep link, doet
`GET .../magic-link/verify?token=...` met **redirects uit**, leest de bearer uit de
`set-auth-token` response-header, bewaart hem. Token-TTL 5 min.

**Transport:** elke call krijgt `Authorization: Bearer <token>` + `X-API-Version: v1`.
Bij 401 op een geauthenticeerde call: token wissen, terug naar anoniem (geen harde
redirect). Verifieer de sessie bij boot; een lokaal geldig token kan server-side dood
zijn na een DB-reseed.

---

## 4. Design-systeem

Warm, aards, vriendelijk. Afgeronde typografie, zachte oppervlakken op een
zand/cream-ondergrond, moss + terracotta accenten. De app staat vast in **light
mode** (negeer de donkere systeemstand).

Palet (hex):

- moss `#6E7B33` (primair), mossDark `#4C5622`, mossSoft `#E7E9D5`
- cream `#FFFDF7` (kaarten/velden), sand `#F3EFE3` (achtergrond)
- terra `#C2762E` (waarschuwing/niet-geverifieerd), rust `#A33B2D` (destructief)
- ink `#2B3320` (primaire tekst), ink2 `#5A6151` (secundaire tekst)
- categoriekleuren: off-leash=moss, swim-beach `#C9A24B`, horeca=terra,
  wash `#4F7A86`, shop `#8A6BA0`, drinking-point `#6E7A82`

Tokens (zoals in de native DesignKit):

- spacing 4/8/12/16/20/24/32; radii 10/14/20/28; controlhoogte 52
- typografie: rounded; display 30 bold, title2 bold, headline, body, callout, caption
- componenten: primaire knop (moss, wit, radius 14, zachte schaduw), secundaire
  knop (cream + dunne rand), kaart (cream, radius 20, subtiele schaduw + 6%-rand),
  invoerveld (cream, radius 14, 12%-rand), chip (capsule, selected=tint, anders
  mossSoft), badge geverifieerd/niet, avatar (cirkel met initialen-fallback op
  moss-gradient), sterren (terracotta), lege/laad/fout-staten.

Splash: moss-gradient met pootafdruk + woordmerk, kort zichtbaar bij boot.

---

## 5. Schermen (overzicht voor de POC)

Tabs: Kaart, Nabij, Toevoegen, Wensen, Profiel.
Pushes/sheets: Spot-detail, Review schrijven, Report, Zoeken, Profiel bewerken,
Hond toevoegen/bewerken, Mijn inzendingen, Over, Moderator-aanmelding, Nieuwe wens,
Wens-detail, Sign-in (ook als gating-sheet vanuit Toevoegen/stemmen).

---

## 6. Geleerde lessen en valkuilen (lees dit vóór je begint)

1. **De bewerkbare polygon-editor is het kernpunt.** Een editable polygon "gratis"
   bestaat alleen in de Google Maps **JS**-API (web). Op native iOS (MapKit),
   react-native-maps én Flutter (`google_maps_flutter`) bouw je hem zelf:
   sleepbare hoekpunt-markers + de polygon hertekenen tijdens slepen + tik-om-toe-
   te-voegen. In Flutter is `Marker(draggable: true)` eersteklas, dus dit wordt naar
   verwachting soepeler dan de react-native-maps-poging waar dit traject mee begon.
   Maak dit het eerste wat je in de POC bouwt en beoordeelt.
2. **Coördinaat-volgorde.** Alles op de draad in GeoJSON is `[lng, lat]` (longitude
   eerst). De vriendelijke submit-vormen (`point`/`polygon`) gebruiken juist named
   keys `{lat, lng}`; de server flipt ze. Niet door elkaar halen.
3. **Categorie-filter op de kaart server-side meegeven** (`?categoryId=`), niet
   client-side filteren na clustering. Anders: bij uitzoomen geeft de server clusters
   in plaats van losse items, en lijkt de kaart leeg.
4. **Google client ids:** de native SDK gebruikt de **iOS** id, maar de idToken-`aud`
   die de server checkt is de **WEB** id (serverClientID). Verwar ze niet.
5. **Sign in with Apple** vereist de `com.apple.developer.applesignin`-entitlement
   én dat die in de **gesignde** binary zit. Een unsigned-archive-dan-export laat
   entitlements vallen; doe een gesignde archive met signing gescoped op de app-
   target (niet globaal op de SPM/plugin-targets).
6. **Release-URL-valkuil (iOS):** een dev-URL (`*.local`/`localhost`) die in de
   release-bundle lekt geeft de "lokaal netwerk"-prompt + een blanco app. Hardcode
   de prod-URL in releases en weiger lokale hosts.
7. **Tap-targets:** rijen met een `Spacer` zijn in het midden niet aantikbaar tenzij
   je de hele rij één hit-area maakt (in SwiftUI: `.contentShape(Rectangle())`). In
   Flutter: gebruik `InkWell`/`GestureDetector` met `behavior: HitTestBehavior.opaque`
   op de hele rij. Triviaal maar makkelijk te missen.
8. **Versienummering:** zorg dat het buildnummer echt uit je config komt; een
   handgeschreven Info.plist kan het stilletjes op 1 zetten.
9. **Magic-link verify:** volg de 302 niet, anders verlies je de `set-auth-token`-
   header.
10. **Stem-proof is best-effort:** stuur de huidige locatie als `proof` mee; geen
    proof = halve weging, telt nog steeds. Blokkeer het stemmen niet op locatie.

---

## 7. Bekende beperkingen / openstaand (gelijk in Expo en native)

- Eigen plek **bewerken/verwijderen** zit nog niet in de client (API-kant deels
  aanwezig). Voor de POC optioneel.
- Een hond-veld **leegmaken** (ras/notitie/foto wissen) werkt nog niet: de client
  laat lege velden weg en de server wist alleen bij een expliciete `null`. Vergt een
  kleine server-DTO-aanpassing (`.nullable()`) plus expliciet `null` sturen.
- Openingstijden worden wel opgeslagen maar nog niet getoond op detail.

---

## 8. Flutter-POC: aanpak

**Eigen branch.** Zet de POC in een eigen git-branch (bijv. `flutter-spike`),
los van `main` en `native-ios-spike`, zodat we makkelijk kunnen vergelijken.

Native API's die je nodig hebt, en de packages die ze leveren:
| Capability | Flutter-package |
|---|---|
| Kaart, markers, clusters, polygonen, sleepbare hoekpunten | `google_maps_flutter` (+ een cluster-package) |
| Sign in with Apple | `sign_in_with_apple` |
| Google Sign In (iOS + Android) | `google_sign_in` |
| Deep links (`vrijehond://verify`) | `app_links` |
| Veilige token-opslag | `flutter_secure_storage` |
| Locatie | `geolocator` |
| Foto kiezen + uploaden | `image_picker` + `dio` (multipart) |

Aanbevolen POC-scope (in deze volgorde):

1. De kaart met de **polygon-editor** (het pijnpunt). Beoordeel of dit goed genoeg
   voelt vóór je verder bouwt.
2. Auth (minimaal Google + magic link; Apple erbij voor iOS-compleetheid).
3. Eén lees-flow (kaart → detail) en één schrijf-flow (plek toevoegen) end-to-end
   tegen de echte API, zodat de contracten in §2 bewezen zijn.

Als dat goed voelt, is de rest invullen volgens §1 t/m §5 rechttoe rechtaan: de
backend en alle contracten staan vast.
