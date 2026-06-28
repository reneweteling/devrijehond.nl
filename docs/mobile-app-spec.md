# De Vrije Hond, mobiele app: feature- en contractspec

Status: levend document, bijgewerkt 2026-06-28 (app build 50).

Dit is de canonieke, framework-onafhankelijke spec van de mobiele app en het is
de bron van waarheid. Werk dit document bij zodra je een mobiele feature
toevoegt/wijzigt of een `/api/v1`-endpoint verandert. De spec is de parity-board
voor twee native clients: de bestaande iOS-app (`apps/ios-native`, SwiftUI) en de
aankomende native Android-app (Kotlin/Compose, zie §8). De eerdere Expo-app
(`apps/mobile`) en de Flutter-POC zijn beide geschrapt; we bouwen native per
platform.

Elke client praat met exact dezelfde backend. De client-laag is dus vervangbaar;
de API, auth en datacontracten hieronder veranderen niet als je van platform
wisselt.

## 0. Architectuur in één alinea

De backend is de Next.js-app onder `apps/web`, die zowel de publieke site als de
API serveert. Productie-origin voor zowel API als auth: `https://api.devrijehond.nl`.
De mobiele client raakt **nooit** de database; alle data loopt via HTTP. Publieke
reads (`/api/v1/...`) zijn anoniem en CDN-cachebaar; persoonlijke calls
(`/api/v1/me/...`) vereisen een bearer-token en zijn no-store. Auth loopt via
BetterAuth onder `/api/auth/...`. De app is **bearer-only**: hij stuurt nooit
cookies (`httpShouldHandleCookies = false`), zie §3.

Kernmodel (community-verificatie): een plek wordt direct gepubliceerd als
`UNVERIFIED`. Stemmen zijn gewogen naar reputatie. `netScore >= +5` → `VERIFIED`;
`denyCount >= 3` → `HIDDEN` (verbergen wint als beide vuren). Drempels staan in
`apps/web/.../lib/verification.ts`.

---

## 1. Feature-inventaris per gebied

Legenda gating: `pub` = anoniem, `auth` = ingelogd, `owner` = eigenaar van de
resource, `staff` = moderator/admin.

### 1.1 Auth en sessie

- Inloggen met **magic link** (e-mail) `pub`
- Inloggen met **Apple** (native) `pub`, alleen iOS
- Inloggen met **Google** (native) `pub`, iOS + Android
- "Check je inbox"-bevestigingsstaat na magic link
- Magic-link verifiëren via **twee kanalen** die op hetzelfde token uitkomen:
  de `vrijehond://verify?token=...` deep link én een https Universal Link op
  `/verify-mobile?token=...`. De web-interstitial op `/verify-mobile` is de
  fallback wanneer de app niet geïnstalleerd is.
- Uitloggen (lokaal: token + Keychain wissen; geen server sign-out nodig) `auth`
- **Account verwijderen** in-app (`DELETE /api/v1/me/account`), daarna automatisch
  uitloggen. App Store-vereiste. `auth`
- Sessiepersistentie (Keychain/Keystore), boot-verificatie (`GET /api/v1/me`)
- Bearer-only transport: geen cookies, elke call draagt `Authorization: Bearer`
- 401 op een geauthenticeerde call → token wissen, terugvallen naar anoniem
- Anonymous-first: uitgelogd start je gewoon op de kaart, nooit een gedwongen login
- Force-update-gate via `GET /api/v1/app-config`

### 1.2 Kaart en ontdekken

- Native kaart met markers, clusters (server-side), regio-polygonen
- POI-markers druppelvorm, verificatie-gestyled (geverifieerd = moss, niet =
  wit/dashed). De naamlabels op de pins zijn **verborgen** (`titleVisibility =
.hidden`, `subtitleVisibility = .hidden`); tik op de pin voor de naam + detail.
- Regio's worden als polygon-overlay getekend (gekleurd per status)
- Clusters: bolletje met telling; grootte/telling schaalt met aantal
- Tik op marker/cluster → detail (sheet)
- Categorie-filter (chips, "Alles" = leeg). Filter gaat **server-side** mee
  (`?categoryId=`), niet client-side na clustering (zie §6)
- Zoeken: plekken (in onze gids) + adressen/plaatsen via geocoder
- Locatie-knop (recenter op de gebruiker), satelliet/standaard-toggle
  (`.hybrid` vs `.standard`), blauwe gebruikerstip
- Legenda geverifieerd/niet-geverifieerd
- Nabij-lijst: dichtstbij eerst, thumbnails, afstand, categorie-filter, zoeken,
  pull-to-refresh

### 1.3 Spot-detail en acties

- Hero-foto (met fallback-placeholder op categorie-icoon), titel, categorie,
  verified-badge, rating
- Beschrijving (rich text, HTML-subset; client strip-tags)
- Community-check-blok: status + voortgang (netScore) + bevestigd/afgewezen
- Stemmen: **Bevestigen** (CONFIRM) / **Afwijzen** (DENY) met proximity-proof `auth`
- **Route**-knop: action sheet Apple Maps / Google Maps / Waze (de laatste twee
  alleen als de app geïnstalleerd is, via `canOpenURL`) `pub`
- **Deel**-knop: deelt de publieke web-URL van de plek (`/plek/<slug>` of
  `/gebied/<slug>`), die op een toestel met de app weer als Universal Link opent
- **Bekijken op kaart** (springt naar de kaart-tab en centreert)
- Voorzieningen (amenities) als chips
- POI-info: adres (open in kaarten-app), telefoon (`tel:`), website
- Reviews: lijst (auteur, sterren, datum, tekst, "N× nuttig") + zelf schrijven `auth`
- Probleem melden (report) met reden-picker `auth`
- **Bewerken**-knop (owner zolang `UNVERIFIED`, staff altijd) → opent SpotEditView `owner`/`staff`
- Moderatie-kaart (verifieer/herstel/verberg/verwijder + bewerk-knop) `staff`
- Na een stem, moderatie of edit ververst het detail; via `onChanged` ververst
  ook de presenter (kaart-markers / lijst)
- Gating: niet stemmen op je eigen plek; stem-UI alleen bij `UNVERIFIED`

### 1.4 Plek toevoegen / bewerken

- Type kiezen: **Gebied** (REGION, polygon) of **Plek** (POI, punt) `auth`
- Native geometrie-editor op MapKit (zie §6):
  - POI: tik om de pin neer te zetten, sleep om te verfijnen
  - REGION: tik om hoekpunten toe te voegen, sleep een genummerd hoekpunt om te
    verplaatsen, "Ongedaan" (laatste punt) en "Wis alles". De polygon wordt live
    hertekend; ≥ 3 punten nodig.
- Locatie zoeken (geocoder) om de kaart naar een plaats te springen
- Detailformulier: naam, categorie (gefilterd op type), beschrijving, amenities
  (gefilterd op categorie), foto's, en voor POI ook adres/website
- Foto-upload met **vierkante crop** (camera + bibliotheek via
  `UIImagePickerController` met `allowsEditing = true`), los upload-endpoint, dan
  de URL's meesturen. Tot 10 foto's bij het toevoegen.
- Indienen → plek verschijnt direct als niet-geverifieerd
- **Eigen plek bewerken** (SpotEditView): naam, beschrijving, website, telefoon,
  categorie, amenities, adres én de **foto** (vervangen via `photoUrls`). Owner
  mag alleen zolang de plek `UNVERIFIED` is; staff mag elke plek, elke status.
  De geometrie is hier niet bewerkbaar, alleen de beschrijvende velden + foto.
- Mijn inzendingen (eigen plekken) `auth`

### 1.5 Profiel, honden, account

- Profiel bekijken: avatar, naam, @handle, reputatie, rol-pill (moderator/beheerder) `auth`
- Profiel bewerken: naam, handle, bio, **avatar uploaden** (vierkante crop) `auth`
- Honden CRUD: toevoegen/bewerken/verwijderen, naam, ras, geboortedatum, foto,
  notitie `owner`
- Moderator-aanmelding: de entry "Meld je aan als moderator" staat in
  Over De Vrije Hond en is **pas actief als je een profielfoto én een naam hebt**
  (`profileComplete`). Daarna: motivatie indienen + status (PENDING/APPROVED/
  REJECTED). `auth`
- Over De Vrije Hond (externe links, app-versie, maker-blok, legal links)
- Uitloggen
- **Account verwijderen** (danger zone) met bevestigings-alert
- Crash reporting via **Sentry**. Firebase Analytics is **verwijderd**: geen
  tracking, geen IDFA. Zie `PrivacyInfo.xcprivacy`.

### 1.6 Wensen (feature requests)

- Lijst met statusfilter (Populair/In overweging/Gepland/Klaar/Afgewezen)
- Kaart per wens: titel, body, component-tag, upvote-aantal
- Nieuw verzoek aanmaken (titel, body, component) `auth`
- Detail + upvote (optimistisch togglen) `auth`

---

## 2. API-contract (de kern voor implementatie)

Alle bodies/responses zijn JSON. Foutformaat overal:
`{ "error": "UPPER_SNAKE_CODE", "message": "...", "details"?: ... }`.
Stuur op elke call `X-API-Version: v1` mee (de app stuurt ook `X-Client-Version`
en `Accept: application/json`). `/me/*` is no-store.
Geauthenticeerd = header `Authorization: Bearer <token>`.

> **OAS-let op.** De OpenAPI-bron is `packages/types` (`registry.ts` + `paths.ts`
>
> - `dto/**`). Een aantal endpoints dat de app wél gebruikt staat (nog) niet in
>   `paths.ts`: `DELETE /me/account`, `GET|POST /me/moderator-application`,
>   `POST /me/uploads`, `GET /geocode`, `GET /app-config`, `GET /me/spots`,
>   `PATCH /me/spots/{id}/moderate`. Wie de Android-client uit de OAS genereert
>   (§8) moet die paden eerst aan `paths.ts` toevoegen, of ze handmatig
>   bijbouwen. De DTO's hieronder zijn leidend.

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
  - Android krijgt z'n eigen OAuth client id (SHA-1 van de signing-key); de
    server-side `aud` blijft de web client id.
- Account-linking: een bestaande magic-link-gebruiker met hetzelfde geverifieerde
  e-mailadres wordt automatisch gekoppeld aan Apple/Google.
- Magic-link mail: de server herschrijft de link naar de HTTPS-interstitial
  `/verify-mobile` (mailclients strippen niet-HTTP(S)-links). Die pagina is
  tegelijk een **Universal Link**: op een toestel met de app geïnstalleerd opent
  iOS de app rechtstreeks op `/verify-mobile?token=...`; anders draait de
  web-interstitial die naar `vrijehond://verify?token=...` hopt.

### 2.2 Publieke reads (/api/v1, anoniem)

| Doel          | Methode + pad                      | Belangrijkste params/vorm                                                                                                                                                                                 |
| ------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kaart-data    | `GET /api/v1/spots/map`            | `minLng,minLat,maxLng,maxLat`, `cluster=true`, optioneel `categoryId`, `type`. Respons `{ items: SpotSummary[], clusters: {lat,lng,count}[] }`. `items[].geometry` = GeoJSON Point of Polygon ([lng,lat]) |
| Lijst / nabij | `GET /api/v1/spots`                | `nearLat,nearLng,limit`. Respons `{ items: SpotSummary[], nextCursor }`                                                                                                                                   |
| Detail        | `GET /api/v1/spots/{slug}`         | Respons SpotDetail (incl. `submittedBy`, `geometry`, `amenities`, `photos`, `verification`)                                                                                                               |
| Reviews       | `GET /api/v1/spots/{slug}/reviews` | Respons `{ items: Review[], nextCursor }`                                                                                                                                                                 |
| Categorieën   | `GET /api/v1/categories`           | optioneel `?type=POI\|REGION`; `{ items: Category[] }`; `Category.type` = `POI` of `REGION`                                                                                                               |
| Amenities     | `GET /api/v1/amenities`            | optioneel `?categoryId=`; `{ items: Amenity[] }`                                                                                                                                                          |
| Wensen        | `GET /api/v1/feature-requests`     | optioneel `?status=`; `{ items: FeatureRequest[], nextCursor }`                                                                                                                                           |
| Geocode       | `GET /api/v1/geocode?q=`           | `{ items: { label, lat, lng }[] }` (min 2 tekens)                                                                                                                                                         |
| App-config    | `GET /api/v1/app-config`           | `{ minSupportedVersion, latestVersion, updateUrl: { ios, android } }`                                                                                                                                     |

### 2.3 Geauthenticeerd (/api/v1/me, bearer verplicht)

| Doel                | Methode + pad                                | Body                                                        | Respons                                                                              |
| ------------------- | -------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Profiel             | `GET /api/v1/me`                             | —                                                           | MeProfile                                                                            |
| Profiel bewerken    | `PATCH /api/v1/me`                           | `{ name?, handle?, bio?, image? }` (nullable → veld wissen) | MeProfile                                                                            |
| Account verwijderen | `DELETE /api/v1/me/account`                  | —                                                           | `{ ok: true }` (plekken → sentinel-account, persoonlijke data cascade)               |
| Mijn plekken        | `GET /api/v1/me/spots`                       | —                                                           | `{ items: SpotSummary[] }`                                                           |
| Plek aanmaken       | `POST /api/v1/me/spots`                      | SubmitSpot (zie §2.5)                                       | 201 SpotDetail                                                                       |
| Plek bewerken       | `PATCH /api/v1/me/spots/{id}`                | UpdateSpot (zie §2.5)                                       | SpotDetail                                                                           |
| Stemmen             | `POST /api/v1/me/spots/{id}/vote`            | `{ value: "CONFIRM"\|"DENY", proof?: {lat,lng} }`           | `{ vote, netScore, confirmCount, denyCount, status }`                                |
| Review plaatsen     | `POST /api/v1/me/spots/{id}/reviews`         | `{ stars: 0..5, body? }`                                    | Review                                                                               |
| Modereren           | `PATCH /api/v1/me/spots/{id}/moderate`       | `{ status: "VERIFIED"\|"UNVERIFIED"\|"HIDDEN"\|"REMOVED" }` | `{ ok: true }` (staff only)                                                          |
| Report              | `POST /api/v1/me/reports`                    | `{ targetType: "SPOT", targetId, reason, note? }`           | `{ id, createdAt }`                                                                  |
| Honden ophalen      | `GET /api/v1/me/dogs`                        | —                                                           | `{ items: Dog[] }`                                                                   |
| Hond aanmaken       | `POST /api/v1/me/dogs`                       | CreateDog (zie §2.5)                                        | 201 Dog                                                                              |
| Hond bewerken       | `PATCH /api/v1/me/dogs/{id}`                 | partial CreateDog                                           | Dog                                                                                  |
| Hond verwijderen    | `DELETE /api/v1/me/dogs/{id}`                | —                                                           | 204                                                                                  |
| Foto upload         | `POST /api/v1/me/uploads`                    | multipart, veld **`file`** (image/jpeg)                     | `{ publicUrl, key }`                                                                 |
| Wens aanmaken       | `POST /api/v1/me/feature-requests`           | `{ title(4..140), body?, component? }`                      | FeatureRequest                                                                       |
| Wens upvote         | `POST /api/v1/me/feature-requests/{id}/vote` | —                                                           | `{ requestId, upvoteCount, viewerHasVoted }`                                         |
| Moderator-aanvraag  | `GET/POST /api/v1/me/moderator-application`  | POST `{ motivation(>=10) }`                                 | POST 201 `{ id, status, motivation, createdAt }`; GET `{ application: ... \| null }` |

Report-redenen: `DUPLICATE`, `WRONG_INFO`, `SPAM`, `INAPPROPRIATE`, `OTHER`.
Wens-statussen: `CONSIDERING`, `PLANNED`, `DONE`, `DECLINED` ("Populair" = geen filter).
Moderatie is staff-only (`withStaffContext`): anoniem → 401, gewone user → 403.
Account verwijderen reassignt de plekken van de gebruiker naar een vast
sentinel-account ("Verwijderde gebruiker"), zodat community-content op de kaart
blijft, en cascade-delete daarna alle persoonlijke data (Dog/Vote/Review/Report/
FeatureRequest/SpotPhoto/ModeratorApplication + de auth-rows).

### 2.4 Belangrijkste responsevormen

- **SpotSummary**: `{ id, slug, type, name, categoryId, status, lat?, lng?, rating:{average,count}, photoUrl?, geometry? }`
- **SpotDetail**: SpotSummary-velden + `description?, category(volledig), address?, phone?, website?, hours?, amenities[], photos[{url,...}], verification{status,netScore,confirmCount,denyCount,verifiedAt}, submittedBy{id,handle?,name?,image?}, createdAt, updatedAt`
- **MeProfile**: `{ id, email, name?, handle?, bio?, image?, role("USER"\|"MODERATOR"\|"ADMIN"), reputation:int, dogs: Dog[], createdAt }`
- **Dog**: `{ id, name, breed?, birthYear?, birthDate?("YYYY-MM-DD"), photoUrl?, note?, createdAt, updatedAt }`
- **Review**: `{ id, spotId, stars, body?, helpfulCount, author{id,handle?,name?,image?}, createdAt }`
- **FeatureRequest**: `{ id, title, body?, component?, status, upvoteCount, viewerHasVoted, author{handle?,image?}, createdAt }`
- **Category**: `{ id, slug, label, type, icon?, color? }`
- **Amenity**: `{ id, slug, label, icon?, sortOrder, categoryIds[] }`
- **ModeratorApplication**: `{ id, status("PENDING"\|"APPROVED"\|"REJECTED"), motivation, createdAt }`
- **AuthToken**: `{ token, expiresAt? }`

### 2.5 SubmitSpot, UpdateSpot en CreateDog (validatie)

SubmitSpot body (`POST /api/v1/me/spots`):

```
{
  type: "POI" | "REGION",          // verplicht
  categoryId: uuid,                // verplicht, uit /categories
  name: string (2..120),           // verplicht
  description?: string (<=4000),
  point?:   { lat, lng },          // POI: precies één van point|polygon|geometry
  polygon?: [{ lat, lng }, ...],   // REGION: >=3 punten (ring wordt server-side gesloten)
  geometry?: GeoJSON,              // alternatief voor point/polygon ([lng,lat])
  amenityIds?: uuid[],
  photos?: string[] (<=10, publicUrl's uit /me/uploads),
  address?, phone?, website?, hours?   // alleen POI; voor REGION genegeerd
}
```

UpdateSpot body (`PATCH /api/v1/me/spots/{id}`), alle velden optioneel; een
weggelaten veld blijft ongewijzigd:

```
{
  name?: string (2..120),
  description?: string|null (<=4000),
  categoryId?: uuid,
  amenityIds?: uuid[],             // vervangt de hele set
  address?, phone?, website?: string|null,
  hours?: json,
  point? / polygon? / geometry?,   // geometrie-edit (door de app niet gebruikt)
  photoUrls?: string[] (<=10)      // vervangt de hele fotoset (al geüpload)
}
```

Owner mag alleen patchen zolang de plek `UNVERIFIED` is (ZenStack-policy); staff
(ADMIN/MODERATOR) mag elke plek, elke status. 403 = niet toegestaan, 404 = niet
gevonden/niet bewerkbaar.

CreateDog body: `{ name(1..60), breed?(<=80), birthDate?("YYYY-MM-DD"), birthYear?(1990..nu), photoUrl?, note?(<=500) }`.
UpdateDog = CreateDog partial (alle velden optioneel).

---

## 3. Auth-flows in detail

**Apple (iOS):** systeem-sheet → `identityToken` (JWT) → `POST .../apple-native {idToken}`
→ bewaar `token`. Vereist de capability/entitlement "Sign in with Apple" op de
App ID en in de gesignde binary (zie §6, build-valkuil).

**Google (iOS + Android):** native SDK met iOS/Android client id + serverClientID
= web id → `idToken` → `POST .../google-native {idToken}` → bewaar `token`.
Registreer de reversed-iOS-id als URL scheme (iOS).

**Magic link:** `POST .../sign-in/magic-link {email, callbackURL:"vrijehond://verify"}`.
De server herschrijft de e-maillink naar de HTTPS-interstitial `/verify-mobile`.
Op een toestel met de app opent die als Universal Link rechtstreeks de app
(`/verify-mobile?token=...`); zonder app draait de web-interstitial die naar
`vrijehond://verify?token=...` doorlinkt. Beide kanalen komen in de app op
dezelfde routine uit: `GET .../magic-link/verify?token=...` met **redirects uit**,
lees de bearer uit de `set-auth-token` response-header, bewaar hem. Token-TTL 5 min.

**Transport:** elke call krijgt `Authorization: Bearer <token>` + `X-API-Version: v1`
(+ `X-Client-Version`). De app is **bearer-only**: cookie-handling staat uit
(`httpShouldHandleCookies = false`). Dat moet ook: anders bewaart en herhaalt
URLSession een Set-Cookie die BetterAuth teruggeeft (bv. bij Apple/Google-login),
en trekt een latere call zónder Origin-header de CSRF-guard (`403
MISSING_OR_NULL_ORIGIN`, opvallend op magic-link sign-in). Bij 401 op een
geauthenticeerde call: token wissen, terug naar anoniem (geen harde redirect).
Verifieer de sessie bij boot; een lokaal geldig token kan server-side dood zijn
na een DB-reseed.

**Account verwijderen:** `DELETE /api/v1/me/account` met de bearer, daarna lokaal
uitloggen (Keychain wissen) en de UI naar anoniem. De server reassignt de plekken
en cascade-delete de rest (§2.3). Idempotent: een al-verwijderd account geeft ook
`{ ok: true }`.

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

## 5. Schermen (overzicht)

Tabs: Kaart, Nabij, Toevoegen, Wensen, Profiel.
Pushes/sheets: Spot-detail, Plek bewerken, Review schrijven, Report, Zoeken,
Profiel bewerken, Hond toevoegen/bewerken, Mijn inzendingen, Over De Vrije Hond,
Moderator-aanmelding, Account verwijderen (alert), Nieuwe wens, Wens-detail,
Sign-in (ook als gating-sheet vanuit Toevoegen/stemmen/recensie/report).
Universal Links (`/plek|gebied/<slug>` en `/verify-mobile`) en de
`vrijehond://`-deep link openen respectievelijk een spot-detail of de
magic-link-redemption over de actieve tab.

---

## 6. Geleerde lessen en valkuilen (lees dit vóór je begint)

1. **De bewerkbare polygon-editor is het kernpunt.** Een editable polygon "gratis"
   bestaat alleen in de Google Maps **JS**-API (web). Op native iOS (MapKit, nu
   gebouwd) en op native Android bouw je hem zelf: sleepbare hoekpunt-markers + de
   polygon hertekenen tijdens slepen + tik-om-toe-te-voegen. De iOS-implementatie
   staat in `AddScreen.swift` (`AddMapView` + `EditableAnnotation`); spiegel die
   aanpak op Android met `Marker(draggable = true)` + een `Polygon`-overlay die
   je live herbouwt.
2. **Coördinaat-volgorde.** Alles op de draad in GeoJSON is `[lng, lat]` (longitude
   eerst). De vriendelijke submit-vormen (`point`/`polygon`) gebruiken juist named
   keys `{lat, lng}`; de server flipt ze. Niet door elkaar halen.
3. **Categorie-filter op de kaart server-side meegeven** (`?categoryId=`), niet
   client-side filteren na clustering. Anders: bij uitzoomen geeft de server clusters
   in plaats van losse items, en lijkt de kaart leeg.
4. **Google client ids:** de native SDK gebruikt de **iOS/Android** id, maar de
   idToken-`aud` die de server checkt is de **WEB** id (serverClientID). Verwar ze niet.
5. **Sign in with Apple** vereist de `com.apple.developer.applesignin`-entitlement
   én dat die in de **gesignde** binary zit. Een unsigned-archive-dan-export laat
   entitlements vallen; doe een gesignde archive met signing gescoped op de app-
   target (niet globaal op de SPM/plugin-targets).
6. **Release-URL-valkuil (iOS):** een dev-URL (`*.local`/`localhost`) die in de
   release-bundle lekt geeft de "lokaal netwerk"-prompt + een blanco app. De base
   URL is een compile-time switch (`#if DEBUG`), prod-URL is hardgecodeerd in de
   `#else`. Op Android: zet de base URL via build-types (debug vs release), nooit
   via een runtime-env die kan lekken.
7. **Bearer-only, geen cookies.** Zet cookie-handling uit op de HTTP-client
   (iOS: `httpShouldHandleCookies = false`; Android/OkHttp: geen `CookieJar`).
   Anders herhaalt de client een BetterAuth Set-Cookie en trip je de CSRF-guard
   (403 `MISSING_OR_NULL_ORIGIN`) op een latere call zonder Origin.
8. **Tap-targets:** rijen met een `Spacer` zijn in het midden niet aantikbaar tenzij
   je de hele rij één hit-area maakt (SwiftUI: `.contentShape(Rectangle())`;
   Compose: `Modifier.clickable` op de hele `Row`).
9. **Versienummering:** zorg dat het buildnummer echt uit je config komt; een
   handgeschreven Info.plist (of een hardcoded `versionCode`) kan het stilletjes
   op 1 zetten.
10. **Magic-link verify:** volg de 302 niet, anders verlies je de `set-auth-token`-
    header. Vang zowel de deep-link (`vrijehond://verify`) als de Universal Link
    (`/verify-mobile`) af en stuur ze door dezelfde redemption-routine.
11. **Stem-proof is best-effort:** stuur de huidige locatie als `proof` mee; geen
    proof = halve weging, telt nog steeds. Blokkeer het stemmen niet op locatie.
12. **Ververs na een mutatie:** na een stem, moderatie of edit moeten zowel het
    detail als de kaart-markers/lijst herladen (in iOS via de `onChanged`-callback
    van SpotDetailView). Reken niet op een cache.

---

## 7. Bekende beperkingen / openstaand

- Een hond-veld **leegmaken** (ras/notitie/foto wissen) werkt nog niet: de client
  laat lege velden weg en `UpdateDogRequestSchema` is `CreateDog.partial()`
  (optioneel, niet nullable). Vergt een DTO-aanpassing (`.nullish()`) plus
  expliciet `null` sturen. Profielvelden (`name/handle/bio/image`) zijn al wel
  nullable.
- De **geometrie** van een bestaande plek is in de app niet bewerkbaar; alleen de
  tekstvelden + foto. De API ondersteunt geometrie-edit wel (point/polygon/geometry
  op de PATCH).
- **Openingstijden** (`hours`) worden opgeslagen maar nog niet getoond op detail
  en niet ingevoerd in de app.
- De **OpenAPI-bron is incompleet** t.o.v. de geïmplementeerde API (zie de
  OAS-let-op boven §2.1). Vul `paths.ts` aan vóór codegen.

---

## 8. Android (Kotlin) target

De volgende client is een **native Android-app in Kotlin met Jetpack Compose**,
geen cross-platform laag. Zelfde backend, zelfde contracten als hierboven; de
client is puur een nieuwe UI + datalaag.

Aanpak:

1. **API-client genereren uit de OAS3-spec.** Trek `/api/v1/openapi.json` en
   genereer een Kotlin-client (bijv. `openapi-generator` met de
   `kotlin`/`retrofit2`-template, of Ktor-client). Let op: vul eerst de
   ontbrekende paden in `packages/types/paths.ts` aan (§2.1 OAS-let-op), anders
   mis je o.a. account-deletion, uploads, geocode, app-config en
   moderator-application in de gegenereerde client. De auth-bridge onder
   `/api/auth/...` staat sowieso buiten de OAS en bouw je handmatig.
2. **UI in Compose tot parity** met §1 t/m §5. Spiegel de schermen + flows van de
   iOS-app; gebruik §4 als design-systeem (dezelfde tokens/kleuren, light-locked).
3. **Native capabilities** en de Android-equivalenten:

| Capability                                                | Android                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Kaart, markers, clusters, polygonen, sleepbare hoekpunten | Google Maps Compose (`maps-compose`) + cluster-util; `Marker(draggable=true)` + `Polygon` |
| Google Sign In                                            | Credential Manager / Google Identity Services (idToken met serverClientID = web id)       |
| Sign in with Apple                                        | n.v.t. op Android (Apple alleen iOS)                                                      |
| Deep links + Universal Links                              | App Links (`vrijehond://verify` + `https://www.devrijehond.nl/...` met assetlinks.json)   |
| Veilige token-opslag                                      | EncryptedSharedPreferences / Keystore                                                     |
| Locatie                                                   | FusedLocationProvider                                                                     |
| Foto kiezen + croppen + uploaden                          | Photo Picker + crop + multipart upload (OkHttp/Ktor)                                      |
| Crash reporting                                           | Sentry (geen analytics, geen advertising-id)                                              |

4. **Bearer-only HTTP** (geen CookieJar, zie §6.7), base URL via build-types,
   `Authorization: Bearer` + `X-API-Version: v1` op elke call.

Begin met de twee bewezen pijnpunten: de polygon-editor (§6.1) en de auth-flows
(§3). De rest is rechttoe rechtaan, want de backend en alle contracten staan vast.
