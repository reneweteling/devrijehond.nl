import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '../legal';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Voorwaarden',
  description: 'De gebruiksvoorwaarden van De Vrije Hond.',
};

export default function TermsPage() {
  return (
    <LegalPage title="Gebruiksvoorwaarden" updated="19 juni 2026">
      <p>
        Welkom bij De Vrije Hond. Door de app of website te gebruiken ga je akkoord met deze
        voorwaarden. De dienst is een community-platform: de inhoud komt van hondenbezitters zelf.
      </p>

      <LegalSection heading="Je account">
        <p>
          Je bent verantwoordelijk voor wat er onder je account gebeurt. Gebruik je echte gegevens
          en houd je inloglink privé. We kunnen een account schorsen bij misbruik.
        </p>
      </LegalSection>

      <LegalSection heading="Bijdragen van de community">
        <p>
          Plekken, foto&apos;s en reviews worden door gebruikers toegevoegd en direct gepubliceerd
          als &quot;niet geverifieerd&quot;. De community bevestigt ze met stemmen; bij genoeg
          bevestigingen worden ze geverifieerd, en bij genoeg afwijzingen automatisch verborgen. Een
          beheerder grijpt alleen in als uitzondering (bijvoorbeeld bij spam of meldingen).
        </p>
        <p>
          Plaats alleen inhoud die je mag delen en die klopt. Geen spam, onrechtmatige of kwetsende
          inhoud. Door inhoud te plaatsen geef je ons een niet-exclusief recht om die binnen de
          dienst te tonen.
        </p>
      </LegalSection>

      <LegalSection heading="Verifieer ter plekke">
        <p>
          Informatie kan verouderd of onjuist zijn. Controleer altijd zelf ter plaatse of een plek
          geschikt en toegankelijk is voor jouw hond, en respecteer lokale regels en bordjes
          (bijvoorbeeld aanlijngeboden of openingstijden).
        </p>
      </LegalSection>

      <LegalSection heading="Aansprakelijkheid">
        <p>
          De dienst wordt aangeboden &quot;zoals die is&quot;. We doen ons best, maar kunnen niet
          garanderen dat alle informatie juist of volledig is. We zijn niet aansprakelijk voor
          schade die voortvloeit uit het gebruik van de dienst of het bezoeken van een plek.
        </p>
      </LegalSection>

      <LegalSection heading="Wijzigingen">
        <p>
          We kunnen deze voorwaarden aanpassen. Bij belangrijke wijzigingen laten we dat weten in de
          app. Blijf je de dienst gebruiken, dan ga je akkoord met de nieuwe versie.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
