import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '../legal';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Account verwijderen',
  description:
    'Hoe je je De Vrije Hond-account en gegevens verwijdert, en wat er wel en niet blijft.',
};

export default function AccountVerwijderenPage() {
  return (
    <LegalPage title="Account verwijderen" updated="1 juli 2026">
      <p>
        Je kunt je De Vrije Hond-account op elk moment zelf verwijderen. Hieronder staat hoe dat
        gaat en welke gegevens daarbij worden verwijderd of bewaard.
      </p>

      <LegalSection heading="In de app">
        <ol>
          <li>Open De Vrije Hond en ga naar het tabblad Profiel.</li>
          <li>Tik onderaan op Account verwijderen.</li>
          <li>Bevestig in het venster dat verschijnt. Je account wordt dan direct verwijderd.</li>
        </ol>
      </LegalSection>

      <LegalSection heading="Op de website">
        <ol>
          <li>
            Log in op <a href="https://www.devrijehond.nl/account">www.devrijehond.nl/account</a>.
          </li>
          <li>Klik op Account verwijderen en bevestig.</li>
        </ol>
      </LegalSection>

      <LegalSection heading="Wat wordt verwijderd">
        <p>Bij het verwijderen halen we je persoonsgegevens definitief weg:</p>
        <ul>
          <li>je account: e-mailadres, naam, gebruikersnaam, bio en avatar;</li>
          <li>je hondenprofielen;</li>
          <li>je verificatiestemmen en de daaraan gekoppelde reputatie;</li>
          <li>je reviews;</li>
          <li>je inloggegevens (e-maillink en gekoppelde Apple- of Google-login).</li>
        </ul>
      </LegalSection>

      <LegalSection heading="Wat blijft bewaard">
        <p>
          Plekken die je aan de kaart hebt toegevoegd blijven zichtbaar voor de community, want
          andere gebruikers bouwen erop voort. Deze plekken worden losgekoppeld van jou en
          toegewezen aan een anoniem account (&quot;Verwijderde gebruiker&quot;), zodat ze niet meer
          naar jou herleidbaar zijn.
        </p>
      </LegalSection>

      <LegalSection heading="Bewaartermijn">
        <p>
          Je persoonsgegevens worden meteen verwijderd. Reservekopieën waarin ze nog kunnen
          voorkomen worden binnen 30 dagen overschreven.
        </p>
      </LegalSection>

      <LegalSection heading="Lukt het niet?">
        <p>
          Kom je niet meer in je account, mail dan naar{' '}
          <a href="mailto:hallo@devrijehond.nl">hallo@devrijehond.nl</a> vanaf het e-mailadres van
          je account, dan verwijderen we het voor je.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
