# App Store submission kit, De Vrije Hond (1.0.0)

Alles wat je nodig hebt om versie 1.0.0 in te dienen, met kant-en-klare teksten
en per onderdeel waar het in App Store Connect (ASC) hoort. App: de Vrije Hond,
bundle `nl.devrijehond.app`, app id 6782167612, team ND82KXRD2Q.

Te kopiëren teksten staan in codeblokken zodat je ze 1-op-1 kunt plakken.

## Status (wat al klaar is)

- Build 49 (1.0.0) staat op TestFlight, is VALID en is gekoppeld aan de App
  Store-versie 1.0. Daardoor vult het app-icon linksboven in ASC zich vanzelf
  (kan een paar minuten duren). Per-build-iconen waren al goed.
- App-kant van de review-eisen is geregeld in de app: in-app account verwijderen,
  privacy-manifest, foto-toestemming, 8-bit icon, Sign in with Apple,
  export-compliance (geen niet-vrijgestelde encryptie).
- Privacyverklaring staat live: https://www.devrijehond.nl/privacy

Wat hieronder staat moet je nog handmatig in ASC invullen.

---

## 1. App-icon (linksboven + listing)

Komt automatisch uit de gekoppelde build (49). Hoef je niets voor te uploaden.
Voor de zekerheid staat de bron hier: `icon/icon-1024.png` (1024x1024, 8-bit,
geen alpha). Als ASC het na verversen nog niet toont: wacht tot de build klaar is
met verwerken, dan verschijnt het.

## 2. Screenshots

Map: `screenshots-6.7/` (4 stuks, 1284x2778 = de 6.7"-maat, een door ASC
geaccepteerde maat). Upload deze onder de iPhone 6.7"-set.

Waar in ASC: App Store-tab -> versie 1.0 -> sectie "App Previews and Screenshots"
-> iPhone 6.7" Display. Sleep de 4 PNG's erin in deze volgorde: 01 kaart,
02 nabij, 03 wensen, 04 inloggen.

## 3. Teksten (App Store-tab -> versie 1.0)

Naam (al ingevuld):

```
De Vrije Hond
```

Ondertitel (max 30 tekens):

```
Vind hondvriendelijke plekken
```

Promotietekst (max 170 tekens, mag je later los aanpassen):

```
Ontdek losloopgebieden, hondenstranden, hondvriendelijke horeca en waterpunten bij jou in de buurt. Eén kaart, toegevoegd en geverifieerd door de community.
```

Beschrijving:

```
De Vrije Hond is dé kaart met hondvriendelijke plekken in heel Nederland, gemaakt voor hondenbazen, door hondenbazen.

Vind in een oogopslag wat er bij jou in de buurt is:
- Losloopgebieden en hondenstranden, getekend als gebieden op de kaart
- Hondvriendelijke horeca waar je hond welkom is
- Waterpunten om je hond te laten drinken
- Was- en spoelplekken en hondvriendelijke winkels

De community houdt de kaart eerlijk. Een nieuwe plek staat meteen online als nog niet geverifieerd. Zodra genoeg hondenbazen in de buurt hem bevestigen, wordt hij geverifieerd. Zo blijft de kaart actueel en betrouwbaar.

Wat je kunt doen:
- De kaart bekijken zonder account
- Plekken toevoegen, een losloopgebied tekenen en foto's plaatsen
- Plekken bevestigen en beoordelen
- Naar een plek navigeren met je eigen kaart-app en plekken delen

Gratis te gebruiken. Doe mee en help de fijnste hondenplekken van Nederland in kaart te brengen.
```

Sleutelwoorden (max 100 tekens, komma-gescheiden, geen spaties):

```
hond,honden,losloopgebied,hondenstrand,hondvriendelijk,uitlaten,wandelen,waterpunt,hondenkaart,terras
```

Wat is er nieuw in deze versie (release notes):

```
De eerste versie van De Vrije Hond. Vind, deel en bevestig hondvriendelijke plekken in heel Nederland.
```

Support-URL:

```
https://www.devrijehond.nl
```

Marketing-URL (optioneel):

```
https://www.devrijehond.nl
```

Copyright:

```
2026 De Vrije Hond
```

## 4. Categorie

App Store-tab -> "General Information" (of bij de versie):

- Primair: Reizen (Travel)
- Secundair: Lifestyle

(Alternatief als Reizen niet passend voelt: primair Lifestyle, secundair Sport.)

## 5. Privacyverklaring + App Privacy

App-niveau -> "App Privacy".

Privacy Policy URL:

```
https://www.devrijehond.nl/privacy
```

Tracking: Nee (we tracken niet; advertentie-personalisatie staat uit).

Verzamelde gegevens (Data Types), allemaal "Niet gebruikt om je te volgen". Dit
moet kloppen met het privacy-manifest in de app:

- E-mailadres -> gekoppeld aan identiteit -> Doel: App-functionaliteit (account)
- Naam -> gekoppeld -> App-functionaliteit
- Locatie (precies) -> niet gekoppeld -> App-functionaliteit (kaart + nabij)
- Foto's of video's -> gekoppeld -> App-functionaliteit (plek-foto's)
- Productinteractie -> niet gekoppeld -> Analyse (Firebase Analytics)
- Crashgegevens -> niet gekoppeld -> App-functionaliteit (Sentry)

## 6. Leeftijdsclassificatie (Age Rating)

App-niveau -> "Age Rating" -> alle vragen op "Geen" / "None". Resultaat: 4+.

## 7. Review-informatie (App Store-tab -> versie 1.0 -> "App Review Information")

Aanmeldgegevens: de kern (de kaart bekijken) werkt zonder inloggen, dus
"Sign-in required" hoeft niet aan. Voor de functies achter login (plek
toevoegen, stemmen, profiel) kan de reviewer inloggen via Apple, Google of een
e-mail-inloglink.

Notities (Notes), plak dit:

```
De kaart en alle plekken zijn zonder account te bekijken (tik op "Bekijk de kaart" / open de Kaart-tab).

Voor het toevoegen, bevestigen of beoordelen van plekken is inloggen nodig. Inloggen kan met Sign in with Apple, met Google, of met een e-mail-inloglink (de link komt per mail binnen en opent de app). Account verwijderen kan in de app onder Profiel.
```

Contactgegevens: je eigen naam, e-mail (rene@weteling.com) en telefoonnummer.

## 8. Export compliance

Bij de build / versie: "Does your app use encryption?" -> alleen standaard
(HTTPS), vrijgesteld. In de app staat `ITSAppUsesNonExemptEncryption = false`,
dus ASC zou hier niet meer naar moeten vragen. Zo wel: kies "None of the
algorithms mentioned above" / vrijgesteld.

## 9. Prijs en beschikbaarheid

App-niveau -> "Pricing and Availability" -> Gratis. Beschikbaarheid: alle landen,
of beperk tot Nederland als je dat liever hebt.

## 10. Build koppelen

Al gedaan via de API: build 49 (1.0.0) is aan versie 1.0 gekoppeld. Controleer in
de App Store-tab -> sectie "Build" dat build 49 staat geselecteerd.

---

## Indien-checklist (in ASC afvinken)

1. [ ] App-icon zichtbaar linksboven (komt vanzelf na build-verwerking)
2. [ ] Screenshots 6.7" geupload (4 stuks uit screenshots-6.7/)
3. [ ] Ondertitel, promotietekst, beschrijving, sleutelwoorden, release notes
4. [ ] Support-URL (+ marketing-URL)
5. [ ] Categorie (Reizen / Lifestyle)
6. [ ] App Privacy: privacyverklaring-URL + data types + geen tracking
7. [ ] Leeftijdsclassificatie 4+
8. [ ] Review-notities + contactgegevens
9. [ ] Export compliance
10. [ ] Prijs: gratis + beschikbaarheid
11. [ ] Build 49 gekoppeld
12. [ ] "Add for Review" / indienen

## Aandachtspunt

Je hebt Firebase Analytics in de app. Dat vereist de tracking-purpose-string
(staat erin) en maakt de privacy-labels iets uitgebreider (productinteractie +
crashgegevens). Wil je de review simpeler, dan kunnen we Firebase Analytics
eruit halen; dan vervallen die twee data-types. Laat maar weten.
