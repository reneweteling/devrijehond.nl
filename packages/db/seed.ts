/**
 * Deterministic, content-rich seed for De Vrije Hond.
 *
 * Ensures the PostGIS extension, then seeds taxonomy (categories + amenities),
 * an admin, a handful of community users, and a realistic set of Amsterdam dog
 * spots: off-leash areas + swim beaches as polygons, and horeca / wash / shop /
 * drinking-point POIs. Spots carry amenities, photos, community votes (so some
 * reach VERIFIED), and reviews (so ratings are populated). Geometry is written
 * via raw PostGIS (the ORM models `geom` as Unsupported): a point for POIs, a
 * generated ring for REGIONs.
 *
 * Re-runnable: wipes spots + community users first, then rebuilds. Uses the raw
 * `db` client (policies bypassed), seeding is a system action.
 */
import { Pool } from 'pg';
import { db } from './src/client';
import { tallyVotesLike } from './seed-helpers';

const ADMIN_EMAIL = 'rene@weteling.com';

const CATEGORIES = [
  {
    slug: 'off-leash',
    label: 'Losloopgebied',
    type: 'REGION',
    icon: 'pawprint.fill',
    color: '#6E7B33',
  },
  {
    slug: 'swim-beach',
    label: 'Zwemstrand',
    type: 'REGION',
    icon: 'beach.umbrella.fill',
    color: '#C9A24B',
  },
  {
    slug: 'horeca',
    label: 'Hondvriendelijke horeca',
    type: 'POI',
    icon: 'cup.and.saucer.fill',
    color: '#C2762E',
  },
  { slug: 'wash', label: 'Was- / spoelplek', type: 'POI', icon: 'drop.fill', color: '#4F7A86' },
  { slug: 'shop', label: 'Winkel', type: 'POI', icon: 'bag.fill', color: '#8A6BA0' },
  {
    slug: 'drinking-point',
    label: 'Drinkpunt',
    type: 'POI',
    icon: 'spigot.fill',
    color: '#6E7A82',
  },
] as const;

const AMENITIES = [
  { slug: 'water-bowl', label: 'Waterbak', icon: 'bowl.fill' },
  { slug: 'treats', label: 'Snoepjes', icon: 'pawprint.fill' },
  { slug: 'indoor-ok', label: 'Binnen ok', icon: 'house.fill' },
  { slug: 'terrace', label: 'Terras', icon: 'sun.umbrella.fill' },
  { slug: 'fenced', label: 'Omheind', icon: 'square.dashed' },
  { slug: 'parking', label: 'Parkeren', icon: 'parkingsign' },
  { slug: 'shade', label: 'Schaduw', icon: 'tree.fill' },
  { slug: 'free', label: 'Gratis', icon: 'eurosign.circle' },
] as const;

// Which amenities make sense per category (drives the category-scoped form).
const AMENITIES_BY_CATEGORY: Record<string, string[]> = {
  'off-leash': ['fenced', 'shade', 'water-bowl', 'parking', 'free'],
  'swim-beach': ['shade', 'parking', 'free', 'water-bowl'],
  horeca: ['water-bowl', 'treats', 'indoor-ok', 'terrace'],
  wash: ['parking', 'free'],
  shop: ['treats', 'indoor-ok', 'parking'],
  'drinking-point': ['water-bowl', 'free', 'shade'],
};

const USERS = [
  {
    email: 'seed-anna@devrijehond.nl',
    name: 'Anna de Vries',
    handle: 'annahond',
    reputation: 42,
    voteWeight: 1.3,
  },
  {
    email: 'seed-bram@devrijehond.nl',
    name: 'Bram Jansen',
    handle: 'bramwandelt',
    reputation: 28,
    voteWeight: 1.1,
  },
  {
    email: 'seed-chris@devrijehond.nl',
    name: 'Chris Bakker',
    handle: 'chrisb',
    reputation: 15,
    voteWeight: 1,
  },
  {
    email: 'seed-daan@devrijehond.nl',
    name: 'Daan Visser',
    handle: 'daanv',
    reputation: 60,
    voteWeight: 1.5,
  },
  {
    email: 'seed-eva@devrijehond.nl',
    name: 'Eva Smit',
    handle: 'evasmit',
    reputation: 9,
    voteWeight: 0.8,
  },
  {
    email: 'seed-femke@devrijehond.nl',
    name: 'Femke Mulder',
    handle: 'femkem',
    reputation: 33,
    voteWeight: 1.2,
  },
  {
    email: 'seed-gijs@devrijehond.nl',
    name: 'Gijs Koster',
    handle: 'gijsk',
    reputation: 21,
    voteWeight: 1,
  },
] as const;

type VoteSpec = { user: number; value: 'CONFIRM' | 'DENY' };
type ReviewSpec = { user: number; stars: number; body: string };

interface SpotSeed {
  slug: string;
  category: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  status?: 'UNVERIFIED' | 'VERIFIED' | 'HIDDEN';
  submitter?: number; // index into USERS, else admin
  amenities?: string[]; // override AMENITIES_BY_CATEGORY subset
  photos?: number; // how many stock photos
  votes?: VoteSpec[];
  reviews?: ReviewSpec[];
  address?: string;
  website?: string;
  regionRadiusM?: number; // for REGION polygon size
}

const RESEARCH: {
  name: string;
  category: string;
  city: string;
  lat: number;
  lng: number;
  description: string;
  radiusM?: number; // geofence size for REGION spots (metres)
}[] = [
  {
    name: 'Amsterdamse Bos',
    category: 'off-leash',
    city: 'Amstelveen',
    lat: 52.3186,
    lng: 4.8358,
    description: 'Groot bosgebied met meerdere losloopzones waar honden het hele jaar los mogen.',
  },
  {
    name: 'Westerpark',
    category: 'off-leash',
    city: 'Amsterdam',
    lat: 52.387,
    lng: 4.874,
    description: 'Stadspark met losloopstroken langs het spoor en bij de rietvelden.',
  },
  {
    name: 'Vondelpark',
    category: 'off-leash',
    city: 'Amsterdam',
    lat: 52.358,
    lng: 4.8686,
    description: 'Centraal stadspark met een aangewezen hondenlosloopveld.',
  },
  {
    name: 'Sloterpark',
    category: 'off-leash',
    city: 'Amsterdam',
    lat: 52.3636,
    lng: 4.809,
    description: 'Park rond de Sloterplas met losloopgebieden waar honden ook kunnen zwemmen.',
  },
  {
    name: 'Gaasperpark',
    category: 'off-leash',
    city: 'Amsterdam',
    lat: 52.3107,
    lng: 4.9939,
    description: 'Aan de westkant van de Gaasperplas ligt een hondenstrand met grasveld.',
  },
  {
    name: 'Diemerbos',
    category: 'off-leash',
    city: 'Diemen',
    lat: 52.338,
    lng: 4.999,
    description: 'Bos waar honden bijna overal het hele jaar los mogen (max 3 per persoon).',
  },
  {
    name: 'Het Twiske',
    category: 'off-leash',
    city: 'Oostzaan',
    lat: 52.45,
    lng: 4.88,
    description:
      'Groot natuur- en recreatiegebied met vijf losloopgebieden en twee hondenstranden.',
  },
  {
    name: 'Kralingse Bos',
    category: 'off-leash',
    city: 'Rotterdam',
    lat: 51.9395,
    lng: 4.516,
    description: 'Grootste stadspark van Rotterdam; in het oosten mogen honden het hele jaar los.',
  },
  {
    name: 'Hondeneiland Zuiderpark',
    category: 'off-leash',
    city: 'Rotterdam',
    lat: 51.878,
    lng: 4.479,
    description: 'De enige plek in het Zuiderpark waar honden los mogen; open veld en water.',
  },
  {
    name: 'Het Park',
    category: 'off-leash',
    city: 'Rotterdam',
    lat: 51.905,
    lng: 4.473,
    description: 'Historisch park bij de Euromast; honden welkom met aangewezen losloopplekken.',
  },
  {
    name: 'Haagse Bos',
    category: 'off-leash',
    city: 'Den Haag',
    lat: 52.093,
    lng: 4.329,
    description: 'Historisch bos in het centrum met losloopplekken en volop ruimte.',
  },
  {
    name: 'Zuiderpark',
    category: 'off-leash',
    city: 'Den Haag',
    lat: 52.0533,
    lng: 4.287,
    description: 'Grootste park van Den Haag met twee aangewezen hondenlosloopvelden.',
  },
  {
    name: 'Bosjes van Poot',
    category: 'off-leash',
    city: 'Den Haag',
    lat: 52.095,
    lng: 4.253,
    description: 'Losloopgebied op duingrond met dennen en eiken, naast het Westduinpark.',
  },
  {
    name: 'Westduinpark',
    category: 'off-leash',
    city: 'Den Haag',
    lat: 52.084,
    lng: 4.235,
    description: 'Groot duingebied tussen Kijkduin en Scheveningen; deels losloopgebied.',
  },
  {
    name: 'Maximapark',
    category: 'off-leash',
    city: 'Utrecht',
    lat: 52.089,
    lng: 5.026,
    description: 'Park in Leidsche Rijn met losloopvelden langs Het Lint en een strandje.',
  },
  {
    name: 'Wilhelminapark',
    category: 'off-leash',
    city: 'Utrecht',
    lat: 52.0855,
    lng: 5.143,
    description: 'Stadspark met een aangewezen hondenlosloopveld.',
  },
  {
    name: 'Haarlemmerhout',
    category: 'off-leash',
    city: 'Haarlem',
    lat: 52.369,
    lng: 4.63,
    description: 'Oud stadsbos waar honden tussen de Wagenweg en Fonteinlaan los mogen.',
  },
  {
    name: 'Veerplas Spaarnwoude',
    category: 'off-leash',
    city: 'Haarlem',
    lat: 52.383,
    lng: 4.684,
    description: 'Plas aan de oostkant van Haarlem; van oktober tot april los rennen en zwemmen.',
  },
  {
    name: 'Schoteroog',
    category: 'off-leash',
    city: 'Haarlem',
    lat: 52.395,
    lng: 4.672,
    description: 'Recreatiegebied met grasvelden en waterkant waar honden los mogen.',
  },
  {
    name: 'Stadswandelpark',
    category: 'off-leash',
    city: 'Eindhoven',
    lat: 51.4255,
    lng: 5.479,
    description: 'Stadspark ten zuiden van het centrum met losloopstroken op de grasvelden.',
  },
  {
    name: 'Losloopterrein Hanevoet',
    category: 'off-leash',
    city: 'Eindhoven',
    lat: 51.412598,
    lng: 5.436441,
    description: 'Aangewezen hondenlosloopterrein in de wijk Hanevoet langs het Dommeldal.',
  },
  {
    name: 'Park Meerland',
    category: 'off-leash',
    city: 'Eindhoven',
    lat: 51.441776,
    lng: 5.404036,
    description: 'Losloopterrein in Park Meerland met ruime grasvelden.',
  },
  {
    name: 'Blixembosch-Oost',
    category: 'off-leash',
    city: 'Eindhoven',
    lat: 51.484387,
    lng: 5.470337,
    description: 'Aangewezen losloopterrein in de noordelijke wijk Blixembosch-Oost.',
  },
  {
    name: 'Urkhoven Tongelre',
    category: 'off-leash',
    city: 'Eindhoven',
    lat: 51.43752,
    lng: 5.530981,
    description: 'Losloopterrein nabij het beekdal van de Kleine Dommel.',
  },
  {
    name: 'Stadspark hondenspeeltuin',
    category: 'off-leash',
    city: 'Groningen',
    lat: 53.2018,
    lng: 6.544,
    description: 'Aangewezen losloopgebied met hondenspeeltuin in het grote Stadspark.',
  },
  {
    name: 'Noorderplantsoen',
    category: 'off-leash',
    city: 'Groningen',
    lat: 53.2245,
    lng: 6.5615,
    description: 'Stadspark met meerdere losloopgebieden en een hondenweide.',
  },
  {
    name: 'Kardinge Bevrijdingsbos',
    category: 'off-leash',
    city: 'Groningen',
    lat: 53.2475,
    lng: 6.6175,
    description: 'Losloopgebied van ca. 12 ha in het Bevrijdingsbos.',
  },
  {
    name: 'Hoornseplas',
    category: 'off-leash',
    city: 'Groningen',
    lat: 53.188,
    lng: 6.554,
    description: 'Losloopstroken langs de Hoornseplas; seizoens- en weekendregels gelden.',
  },
  {
    name: 'Goffertpark',
    category: 'off-leash',
    city: 'Nijmegen',
    lat: 51.8245,
    lng: 5.839,
    description: 'Twee kleine losloopgebieden in het Goffertpark.',
  },
  {
    name: 'Heumensoord',
    category: 'off-leash',
    city: 'Nijmegen',
    lat: 51.795,
    lng: 5.848,
    description: 'Bosrijk losloopgebied ten zuidoosten van Nijmegen.',
  },
  {
    name: 'Overasseltse en Hatertse Vennen',
    category: 'off-leash',
    city: 'Overasselt',
    lat: 51.772,
    lng: 5.774,
    description: 'Losloopgebied met een groot ven en strandjes om te zwemmen.',
  },
  {
    name: 'Berendonck',
    category: 'off-leash',
    city: 'Wijchen',
    lat: 51.8055,
    lng: 5.773,
    description: 'Strand en plas waar honden buiten het hoogseizoen los mogen en zwemmen.',
  },
  {
    name: 'Oude Warande',
    category: 'off-leash',
    city: 'Tilburg',
    lat: 51.561,
    lng: 5.0335,
    description: 'Losloopzone in het sterrenbos de Oude Warande.',
  },
  {
    name: 'Reeshofbos',
    category: 'off-leash',
    city: 'Tilburg',
    lat: 51.565,
    lng: 4.999,
    description: 'Aangewezen losloopzone in het Reeshofbos.',
  },
  {
    name: 'Reuselpad',
    category: 'off-leash',
    city: 'Tilburg',
    lat: 51.538,
    lng: 5.053,
    description: 'Losloopzone langs het Reuselpad in Stadsbos013.',
  },
  {
    name: 'Loonse en Drunense Duinen',
    category: 'off-leash',
    city: 'Udenhout',
    lat: 51.6351,
    lng: 5.1115,
    description: 'Groot losloopgebied met routes door zandverstuiving en bos.',
  },
  {
    name: 'Mastbos',
    category: 'off-leash',
    city: 'Breda',
    lat: 51.556,
    lng: 4.778,
    description: 'Losloopgebied van ca. 82 ha met uitgezette Snuffelroute en poedelpoel.',
  },
  {
    name: 'Sonse Bergen',
    category: 'off-leash',
    city: 'Son en Breugel',
    lat: 51.507,
    lng: 5.487,
    description: 'Bospaden, open zand en een strandje aan de Dommel.',
  },
  {
    name: 'Hondenstrand Zandvoort',
    category: 'swim-beach',
    city: 'Zandvoort',
    lat: 52.365911,
    lng: 4.523213,
    description: 'Honden los rennen en zwemmen ten noorden van paal 47 en zuiden van paal 36.',
  },
  {
    name: 'Hondenstrand Bloemendaal',
    category: 'swim-beach',
    city: 'Bloemendaal aan Zee',
    lat: 52.415875,
    lng: 4.554048,
    description: 'Rustig losloopstrand tussen Parnassia en het naaktstrand, hele jaar los.',
  },
  {
    name: 'Hondenstrand Scheveningen',
    category: 'swim-beach',
    city: 'Den Haag',
    lat: 52.117,
    lng: 4.288,
    description: 'Op het Noorderstrand na het Zwarte Pad het hele jaar los en zwemmen.',
  },
  {
    name: 'Hondenstrand Kijkduin',
    category: 'swim-beach',
    city: 'Den Haag',
    lat: 52.062475,
    lng: 4.216277,
    description: 'Vanaf strandslag 2 zuidwaarts het hele jaar los op het Zuiderstrand.',
  },
  {
    name: 'Hondenstrand Wijk aan Zee',
    category: 'swim-beach',
    city: 'Wijk aan Zee',
    lat: 52.494644,
    lng: 4.58883,
    description: 'Brede strook waar honden het hele jaar los mogen.',
  },
  {
    name: 'Hondenstrand IJmuiderslag',
    category: 'swim-beach',
    city: 'IJmuiden',
    lat: 52.448346,
    lng: 4.572802,
    description: 'Permanent losloopgebied langs het Kennemerstrand.',
  },
  {
    name: 'Hondenstrand Hoek van Holland',
    category: 'swim-beach',
    city: 'Hoek van Holland',
    lat: 51.985329,
    lng: 4.106054,
    description: 'Zuidelijkste deel van het strand bij de Nieuwe Waterweg, hele jaar los.',
  },
  {
    name: 'Hondenstrand Katwijk',
    category: 'swim-beach',
    city: 'Katwijk aan Zee',
    lat: 52.211354,
    lng: 4.404273,
    description: 'Losloopstrand bij de Coepelduynen richting Noordwijk.',
  },
  {
    name: 'Hondenstrand Noordwijk',
    category: 'swim-beach',
    city: 'Noordwijk',
    lat: 52.23374,
    lng: 4.420345,
    description: 'Groot losloopstrand vanaf strandopgang 1 tot Katwijk.',
  },
  {
    name: 'Hondenstrand Callantsoog',
    category: 'swim-beach',
    city: 'Callantsoog',
    lat: 52.833469,
    lng: 4.695024,
    description: 'Strand waar honden buiten het hoogseizoen de hele dag los mogen.',
  },
  {
    name: 'Hondenstrand Petten',
    category: 'swim-beach',
    city: 'Petten',
    lat: 52.770721,
    lng: 4.658675,
    description: 'Strand waar honden tussen oktober en mei de hele dag los mogen.',
  },
  {
    name: 'Hondenstrand Texel Paal 9',
    category: 'swim-beach',
    city: 'Den Hoorn',
    lat: 53.045,
    lng: 4.737,
    description: 'Bij Paal 9 mogen honden het hele jaar los rennen en zwemmen.',
  },
  {
    name: 'Hondenstrand Westerschouwen',
    category: 'swim-beach',
    city: 'Burgh-Haamstede',
    lat: 51.710702,
    lng: 3.691122,
    description: 'Populair losloopstrand aan de westpunt van Schouwen.',
  },
  {
    name: 'Brouwersdam-Zuid',
    category: 'swim-beach',
    city: 'Scharendijke',
    lat: 51.742609,
    lng: 3.824315,
    description: 'Strandstrook aan de Noordzeekant van de Brouwersdam, buiten seizoen los.',
  },
  {
    name: 'Oosterstrand Domburg',
    category: 'swim-beach',
    city: 'Domburg',
    lat: 51.561854,
    lng: 3.477968,
    description: 'Speciaal hondenstrand ten noorden van Domburg.',
  },
  {
    name: 'Hondenstrand Cadzand',
    category: 'swim-beach',
    city: 'Cadzand',
    lat: 51.376408,
    lng: 3.373051,
    description: 'Breed wit strand; honden buiten het hoogseizoen de hele dag los.',
  },
  {
    name: 'Hondenstrand Bussloo',
    category: 'swim-beach',
    city: 'Wilp',
    lat: 52.204845,
    lng: 6.100116,
    description: 'Hondenstrand aan de recreatieplas om te zwemmen en spelen.',
  },
  {
    name: 'Strand Nulde',
    category: 'swim-beach',
    city: 'Putten',
    lat: 52.266277,
    lng: 5.531933,
    description: 'Recreatiegebied aan het Nuldernauw met een hondenstrand.',
  },
  {
    name: 'Woof & Me',
    category: 'horeca',
    city: 'Amsterdam',
    lat: 52.3543,
    lng: 4.8945,
    description: 'Hondencafe in De Pijp; honden binnen en buiten welkom, met hondenmenu.',
  },
  {
    name: 'Pension Homeland',
    category: 'horeca',
    city: 'Amsterdam',
    lat: 52.3713,
    lng: 4.9197,
    description: 'Cafe-restaurant op het Marineterrein; honden welkom op het terras.',
  },
  {
    name: 'Pllek',
    category: 'horeca',
    city: 'Amsterdam',
    lat: 52.4012,
    lng: 4.8939,
    description: 'Hotspot op de NDSM-werf; honden welkom op het strandterras aan het IJ.',
  },
  {
    name: 'Cafecito',
    category: 'horeca',
    city: 'Rotterdam',
    lat: 51.9229,
    lng: 4.4823,
    description: 'Koffiebranderij aan de Meent; je aangelijnde hond mag mee.',
  },
  {
    name: 'Appels en Peren',
    category: 'horeca',
    city: 'Den Haag',
    lat: 52.0668,
    lng: 4.2735,
    description: 'Buurtrestaurant in de Vruchtenbuurt; honden welkom.',
  },
  {
    name: 'Loft 88',
    category: 'horeca',
    city: 'Utrecht',
    lat: 52.0954,
    lng: 5.1242,
    description: 'Koffiebar aan de Voorstraat; honden krijgen vers water en zijn welkom.',
  },
  {
    name: 'Parkpaviljoen Philips de Jongh',
    category: 'horeca',
    city: 'Eindhoven',
    lat: 51.4525,
    lng: 5.447,
    description: 'Paviljoen in het park; honden welkom met eigen hondenmenu.',
  },
  {
    name: 'Rabauw Brewpub',
    category: 'horeca',
    city: 'Eindhoven',
    lat: 51.4485,
    lng: 5.4585,
    description: 'Brouwerij-taproom op Strijp-S; aangelijnde honden welkom.',
  },
  {
    name: 'Fernweh',
    category: 'horeca',
    city: 'Groningen',
    lat: 53.228,
    lng: 6.5705,
    description: 'Restaurant en koffiebar; honden welkom met eigen menu en waterbak.',
  },
  {
    name: 'Restaurant Frenchie',
    category: 'horeca',
    city: 'Haarlem',
    lat: 52.3795,
    lng: 4.636,
    description: 'Frans-Europees restaurant in het centrum; honden welkom.',
  },
  {
    name: 'Eetcafe De Plak',
    category: 'horeca',
    city: 'Nijmegen',
    lat: 51.847,
    lng: 5.8615,
    description: 'Vegetarisch-vegan eetcafe; je hond mag mee naar binnen.',
  },
  {
    name: 'Cafe Brandpunt',
    category: 'horeca',
    city: 'Tilburg',
    lat: 51.556,
    lng: 5.0905,
    description: 'Bruin cafe aan het Piusplein; honden welkom.',
  },
  {
    name: 'Ranzijn Hondenwasstraat',
    category: 'wash',
    city: 'Amsterdam',
    lat: 52.3347,
    lng: 4.9233,
    description: 'Zelf je hond wassen in speciale baden met warm water en fohn.',
  },
  {
    name: 'Dogwash Rotterdam',
    category: 'wash',
    city: 'Rotterdam',
    lat: 51.897,
    lng: 4.467,
    description: 'Zelfbediening dogwash bij dierenspeciaalzaak Yardic.',
  },
  {
    name: 'Steck Hondenwasstraat',
    category: 'wash',
    city: 'Utrecht',
    lat: 52.1175,
    lng: 5.1095,
    description: 'Gratis hondenwasstraat voor Vrienden van Steck.',
  },
  {
    name: 'Avonturia Hondenwasstraat',
    category: 'wash',
    city: 'Den Haag',
    lat: 52.066,
    lng: 4.264,
    description: 'Zelfbediening dogwash met touchscreen en 8 wasprogrammas.',
  },
  {
    name: 'GroenRijk Hondenwasstraat',
    category: 'wash',
    city: 'Tilburg',
    lat: 51.582,
    lng: 5.079,
    description: 'Zelf je hond wassen met automatische shampoo en droger.',
  },
  {
    name: 'Maxi Zoo Dogwash',
    category: 'wash',
    city: 'Groningen',
    lat: 53.233,
    lng: 6.531,
    description: 'Zelfbediening dogwash bij de Maxi Zoo aan de Reitdiephaven.',
  },
  {
    name: 'Pets Place West',
    category: 'shop',
    city: 'Amsterdam',
    lat: 52.369,
    lng: 4.873,
    description: 'Dierenspeciaalzaak in Amsterdam-West waar honden welkom zijn.',
  },
  {
    name: 'Jumper Utrecht',
    category: 'shop',
    city: 'Utrecht',
    lat: 52.111,
    lng: 5.098,
    description: 'Grote dierenwinkel waar je hond van harte welkom is.',
  },
  {
    name: 'Pets Place Boerenbond',
    category: 'shop',
    city: 'Eindhoven',
    lat: 51.463,
    lng: 5.505,
    description: 'Dierenspeciaalzaak en tuincentrum in een; honden welkom.',
  },
  {
    name: 'Jumper Nijmegen',
    category: 'shop',
    city: 'Nijmegen',
    lat: 51.842,
    lng: 5.843,
    description: 'Dierenspeciaalzaak aan de Wolfskuilseweg; honden welkom.',
  },
  {
    name: 'Discus Kleverpark',
    category: 'shop',
    city: 'Haarlem',
    lat: 52.392,
    lng: 4.631,
    description: 'Onafhankelijke dierenwinkel in de Kleverparkbuurt; honden welkom.',
  },
  {
    name: 'Discus Animo',
    category: 'shop',
    city: 'Tilburg',
    lat: 51.561,
    lng: 5.083,
    description: 'Dierenspeciaalzaak aan de Gasthuisring; honden welkom.',
  },
  {
    name: 'Waterpomp Landgoed Marlot',
    category: 'drinking-point',
    city: 'Den Haag',
    lat: 52.101,
    lng: 4.346,
    description: 'Bij de parkingang staat een waterpomp waar de hond kan drinken.',
  },
  {
    name: 'Drinkwater Chez Favie',
    category: 'drinking-point',
    city: 'Amstelveen',
    lat: 52.316,
    lng: 4.829,
    description: 'Bij het hondenterras staan altijd drinkbakken met vers water klaar.',
  },
  {
    name: 'Hondenspeelplaats De Buitenhof',
    category: 'drinking-point',
    city: 'Utrecht',
    lat: 52.102,
    lng: 5.026,
    description: 'Omheinde hondenspeelplaats met water om te zwemmen en drinken.',
  },
  {
    name: 'De Hei (Laarder Wasmeren)',
    category: 'off-leash',
    city: 'Laren',
    lat: 52.2725,
    lng: 5.2345,
    description:
      'Groot losloopgebied op de Gooise heide; eindeloos struinen over de hei en door het bos.',
    radiusM: 1900,
  },
  {
    name: 'Westerheide',
    category: 'off-leash',
    city: 'Hilversum',
    lat: 52.2585,
    lng: 5.1865,
    description: 'Uitgestrekte heide tussen Hilversum en Laren waar honden vrij mogen rennen.',
    radiusM: 1700,
  },
  {
    name: 'Bussumerheide en Franse Kampheide',
    category: 'off-leash',
    city: 'Hilversum',
    lat: 52.2735,
    lng: 5.1645,
    description: 'Grote aaneengesloten heide; populair losloopgebied in het Gooi.',
    radiusM: 1600,
  },
  {
    name: 'Spanderswoud',
    category: 'off-leash',
    city: 'Bussum',
    lat: 52.2515,
    lng: 5.1455,
    description: 'Bosgebied tussen Bussum en Hilversum met losloopzones en vennen.',
    radiusM: 1100,
  },
  {
    name: 'Amelisweerd',
    category: 'off-leash',
    city: 'Bunnik',
    lat: 52.0735,
    lng: 5.1655,
    description: 'Landgoed met oude lanen langs de Kromme Rijn; deels losloopgebied.',
    radiusM: 1200,
  },
  {
    name: 'Beatrixpark',
    category: 'off-leash',
    city: 'Amsterdam',
    lat: 52.3385,
    lng: 4.8815,
    description: 'Stadspark bij de Zuidas met aangewezen losloopveld.',
    radiusM: 500,
  },
  {
    name: 'Flevopark',
    category: 'off-leash',
    city: 'Amsterdam',
    lat: 52.3625,
    lng: 4.9515,
    description: 'Park aan het IJ in Oost met losloopstroken en een zwemplek.',
    radiusM: 700,
  },
  {
    name: 'Park Frankendael',
    category: 'off-leash',
    city: 'Amsterdam',
    lat: 52.3515,
    lng: 4.9285,
    description: 'Groen park in de Watergraafsmeer met een hondenlosloopgebied.',
    radiusM: 500,
  },
  {
    name: 'Park Sonsbeek',
    category: 'off-leash',
    city: 'Arnhem',
    lat: 51.99,
    lng: 5.905,
    description: 'Glooiend stadspark met vijvers en waterval; aangewezen losloopplekken.',
    radiusM: 900,
  },
  {
    name: 'Park Transwijk',
    category: 'off-leash',
    city: 'Utrecht',
    lat: 52.073,
    lng: 5.105,
    description: 'Ruim stadspark in Kanaleneiland met een hondenlosloopveld.',
    radiusM: 600,
  },
  {
    name: 'Kralingse Plas hondenstrand',
    category: 'swim-beach',
    city: 'Rotterdam',
    lat: 51.9365,
    lng: 4.5205,
    description: 'Strandje aan de Kralingse Plas waar honden mogen zwemmen.',
    radiusM: 500,
  },
  {
    name: 'IJzeren Man',
    category: 'swim-beach',
    city: 'Vught',
    lat: 51.6555,
    lng: 5.2735,
    description: 'Vennen bij Vught met een hondenstrand om te zwemmen.',
    radiusM: 600,
  },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const REVIEW_SNIPPETS = [
  'Heerlijke plek, onze hond vindt het top.',
  'Veel ruimte en andere honden om mee te spelen.',
  'Mooi stuk natuur, vaste favoriet voor ons rondje.',
  'Personeel is dol op honden, echt een aanrader.',
  'Lekker rustig doordeweeks, schoon en goed onderhouden.',
  'Fijn dat de hond hier los mag, dat is zeldzaam.',
];

// Build the seed spots from the researched dataset. Deterministic: every third
// spot reaches VERIFIED with a handful of weighted confirms (and sometimes a
// review); the rest stay UNVERIFIED with a few or no votes. The submitter never
// votes on their own spot.
function buildSpots(): SpotSeed[] {
  const N = USERS.length;
  return RESEARCH.map((r, i): SpotSeed => {
    const isRegion = r.category === 'off-leash' || r.category === 'swim-beach';
    const submitter = i % N;
    const verified = i % 3 === 0;
    const pool = Array.from({ length: N }, (_, u) => u).filter((u) => u !== submitter);
    const nVotes = verified ? 5 : i % 3;
    const votes: VoteSpec[] = pool.slice(0, nVotes).map((u) => ({ user: u, value: 'CONFIRM' }));
    const reviews: ReviewSpec[] =
      verified && i % 2 === 0
        ? [
            {
              user: pool[0] ?? 1,
              stars: 4 + (i % 2),
              body: REVIEW_SNIPPETS[i % REVIEW_SNIPPETS.length] ?? '',
            },
          ]
        : [];
    return {
      slug: `${slugify(r.name)}-${slugify(r.city)}`,
      category: r.category,
      name: r.name,
      description: `${r.description} (${r.city})`,
      lat: r.lat,
      lng: r.lng,
      status: verified ? 'VERIFIED' : 'UNVERIFIED',
      submitter,
      photos: verified ? 2 : 1,
      votes,
      reviews,
      regionRadiusM: isRegion ? (r.radiusM ?? 700) : undefined,
    };
  });
}

const SPOTS: SpotSeed[] = buildSpots();

/** A rough N-point ring around a centroid (metres → degrees), closed. */
function ring(lat: number, lng: number, radiusM: number): number[][] {
  const pts: number[][] = [];
  const n = 7;
  const latM = 111_320;
  const lngM = 111_320 * Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * Math.PI;
    // slight per-vertex jitter so it isn't a perfect circle
    const r = radiusM * (0.82 + 0.18 * Math.abs(Math.sin(a * 2)));
    const dLat = (r * Math.sin(a)) / latM;
    const dLng = (r * Math.cos(a)) / lngM;
    pts.push([+(lng + dLng).toFixed(6), +(lat + dLat).toFixed(6)]);
  }
  pts.push(pts[0]!); // close the ring
  return pts;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');

  // --- Reset (re-runnable). Deleting spots + non-admin users cascades. ---
  await db.vote.deleteMany({});
  await db.review.deleteMany({});
  await db.spotPhoto.deleteMany({});
  await db.spotAmenity.deleteMany({});
  await db.spot.deleteMany({});
  await db.featureVote.deleteMany({});
  await db.featureRequest.deleteMany({});
  await db.user.deleteMany({ where: { email: { not: ADMIN_EMAIL } } });

  // --- Admin + taxonomy ---
  const admin = await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN' },
    create: {
      email: ADMIN_EMAIL,
      name: 'René',
      handle: 'rene',
      role: 'ADMIN',
      emailVerified: true,
    },
  });

  const catId: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      update: { label: c.label, icon: c.icon, color: c.color, sortOrder: i },
      create: { ...c, sortOrder: i, status: 'ACTIVE', visible: true },
    });
    catId[c.slug] = row.id;
  }

  const amenityId: Record<string, string> = {};
  for (const [i, a] of AMENITIES.entries()) {
    const row = await db.amenity.upsert({
      where: { slug: a.slug },
      update: { label: a.label, icon: a.icon, sortOrder: i },
      create: { ...a, sortOrder: i, status: 'ACTIVE', visible: true },
    });
    amenityId[a.slug] = row.id;
  }

  // Link amenities to the categories that offer them.
  await db.amenityOnCategory.deleteMany({});
  for (const [catSlug, amenitySlugs] of Object.entries(AMENITIES_BY_CATEGORY)) {
    for (const aSlug of amenitySlugs) {
      await db.amenityOnCategory.create({
        data: { categoryId: catId[catSlug]!, amenityId: amenityId[aSlug]! },
      });
    }
  }

  // --- Community users ---
  const userId: string[] = [];
  for (const u of USERS) {
    const row = await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        handle: u.handle,
        // Anna is seeded as a MODERATOR so the role is demonstrable in admin.
        role: u.email === 'seed-anna@devrijehond.nl' ? 'MODERATOR' : 'USER',
        emailVerified: true,
        reputation: u.reputation,
        voteWeight: u.voteWeight,
      },
    });
    userId.push(row.id);
  }
  const submitterOf = (s: SpotSeed): string =>
    s.submitter == null ? admin.id : (userId[s.submitter] ?? admin.id);

  // --- Spots ---
  const regionGeoms: { id: string; coords: number[][] }[] = [];
  for (const s of SPOTS) {
    const cat = CATEGORIES.find((c) => c.slug === s.category)!;
    const votes = s.votes ?? [];
    const tally = tallyVotesLike(
      votes.map((v) => ({ value: v.value, weight: USERS[v.user]?.voteWeight ?? 1 })),
    );
    const reviews = s.reviews ?? [];
    const ratingCount = reviews.length;
    const ratingAvg = ratingCount
      ? +(reviews.reduce((sum, r) => sum + r.stars, 0) / ratingCount).toFixed(2)
      : 0;
    const status = s.status ?? 'UNVERIFIED';

    const spot = await db.spot.create({
      data: {
        slug: s.slug,
        type: cat.type,
        categoryId: catId[s.category]!,
        name: s.name,
        description: s.description,
        status,
        lat: s.lat,
        lng: s.lng,
        address: s.address ?? null,
        website: s.website ?? null,
        confirmScore: tally.confirmScore,
        denyScore: tally.denyScore,
        netScore: tally.netScore,
        confirmCount: tally.confirmCount,
        denyCount: tally.denyCount,
        ratingAvg,
        ratingCount,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
        hiddenAt: status === 'HIDDEN' ? new Date() : null,
        submittedById: submitterOf(s),
      },
      select: { id: true },
    });

    // Amenities (category defaults unless overridden).
    const amSlugs = s.amenities ?? AMENITIES_BY_CATEGORY[s.category] ?? [];
    if (amSlugs.length) {
      await db.spotAmenity.createMany({
        data: amSlugs.map((a) => ({ spotId: spot.id, amenityId: amenityId[a]! })),
      });
    }

    // Photos (deterministic stock images).
    const photoN = s.photos ?? 0;
    if (photoN > 0) {
      await db.spotPhoto.createMany({
        data: Array.from({ length: photoN }, (_, n) => ({
          spotId: spot.id,
          url: `https://picsum.photos/seed/${s.slug}-${n}/900/675`,
          uploadedById: submitterOf(s),
          status: 'ACTIVE' as const,
          sortOrder: n,
        })),
      });
    }

    // Votes (one per distinct user).
    if (votes.length) {
      await db.vote.createMany({
        data: votes.map((v) => ({
          spotId: spot.id,
          userId: userId[v.user]!,
          value: v.value,
          weight: USERS[v.user]?.voteWeight ?? 1,
          proximityVerified: v.value === 'CONFIRM',
        })),
      });
    }

    // Reviews.
    for (const r of reviews) {
      await db.review.create({
        data: {
          spotId: spot.id,
          userId: userId[r.user]!,
          stars: r.stars,
          body: r.body,
          status: 'ACTIVE',
        },
      });
    }

    if (cat.type === 'REGION') {
      regionGeoms.push({ id: spot.id, coords: ring(s.lat, s.lng, s.regionRadiusM ?? 280) });
    }
  }

  // --- Feature requests (community product input) ---
  const FEATURE_REQUESTS: {
    title: string;
    body: string;
    component: string;
    status: 'CONSIDERING' | 'PLANNED' | 'DONE' | 'DECLINED';
    by: number;
    voters: number[];
  }[] = [
    {
      title: 'Hondentrimsalons op de kaart',
      body: 'Zou mooi zijn als trimsalons een eigen categorie krijgen.',
      component: 'Kaart',
      status: 'CONSIDERING',
      by: 0,
      voters: [1, 2, 3, 5, 6],
    },
    {
      title: 'Route naar een losloopgebied',
      body: 'Een knop "breng me ernaartoe" die de navigatie opent.',
      component: 'Kaart',
      status: 'CONSIDERING',
      by: 1,
      voters: [0, 2, 3, 4, 5, 6],
    },
    {
      title: 'Offline kaart voor onderweg',
      body: 'Handig op plekken zonder bereik.',
      component: 'Kaart',
      status: 'PLANNED',
      by: 3,
      voters: [0, 4, 5],
    },
    {
      title: 'Filteren op "omheind"',
      body: 'Snel alleen omheinde gebieden zien.',
      component: 'Kaart',
      status: 'DONE',
      by: 5,
      voters: [1, 2],
    },
    {
      title: 'Melding bij een nieuwe plek in de buurt',
      body: 'Push als er iets nieuws vlakbij wordt toegevoegd.',
      component: 'Anders',
      status: 'CONSIDERING',
      by: 2,
      voters: [0, 4],
    },
    {
      title: 'Hondenweer-waarschuwing',
      body: 'Waarschuwing bij te warm asfalt.',
      component: 'Anders',
      status: 'DECLINED',
      by: 4,
      voters: [],
    },
  ];
  for (const fr of FEATURE_REQUESTS) {
    const created = await db.featureRequest.create({
      data: {
        title: fr.title,
        body: fr.body,
        component: fr.component,
        status: fr.status,
        upvoteCount: fr.voters.length,
        createdById: userId[fr.by]!,
      },
      select: { id: true },
    });
    if (fr.voters.length) {
      await db.featureVote.createMany({
        data: fr.voters.map((u) => ({ requestId: created.id, userId: userId[u]! })),
      });
    }
  }

  // --- Geometry: points for POIs, polygons for REGIONs ---
  await pool.query(
    `UPDATE "Spot" SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
       WHERE geom IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;`,
  );
  for (const r of regionGeoms) {
    const geojson = JSON.stringify({ type: 'Polygon', coordinates: [r.coords] });
    await pool.query(
      `UPDATE "Spot" SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE id = $2;`,
      [geojson, r.id],
    );
  }

  await pool.end();

  const verified = SPOTS.filter((s) => s.status === 'VERIFIED').length;
  console.log(
    `Seeded: admin=${admin.email}, users=${USERS.length}, categories=${CATEGORIES.length}, ` +
      `amenities=${AMENITIES.length}, spots=${SPOTS.length} (verified=${verified}), ` +
      `reviews=${SPOTS.reduce((n, s) => n + (s.reviews?.length ?? 0), 0)}, ` +
      `votes=${SPOTS.reduce((n, s) => n + (s.votes?.length ?? 0), 0)}, ` +
      `featureRequests=${FEATURE_REQUESTS.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
