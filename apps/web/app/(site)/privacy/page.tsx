import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '../legal';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Privacyverklaring',
  description: 'Hoe De Vrije Hond met je gegevens omgaat.',
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacyverklaring" updated="19 juni 2026">
      <p>
        De Vrije Hond is een community-kaart van hondvriendelijke plekken in Nederland. Deze
        verklaring legt uit welke gegevens we verzamelen, waarom, en welke rechten je hebt. We
        verwerken zo min mogelijk en verkopen je gegevens nooit.
      </p>

      <LegalSection heading="Welke gegevens we verwerken">
        <ul>
          <li>
            <strong>Account:</strong> je e-mailadres en, als je dat instelt, je naam, gebruikersnaam
            (handle), korte bio en avatar. Inloggen kan via een e-maillink of via Apple/Google.
          </li>
          <li>
            <strong>Honden:</strong> de profielen die je zelf toevoegt (naam, ras, geboortejaar,
            foto).
          </li>
          <li>
            <strong>Bijdragen:</strong> plekken die je inzendt, je verificatiestemmen, reviews,
            foto&apos;s en feature-verzoeken.
          </li>
          <li>
            <strong>Locatie:</strong> alleen als je toestemming geeft. We gebruiken je locatie om de
            kaart bij jou te centreren en om te bepalen of je dicht genoeg bij een plek bent om die
            te bevestigen. We bewaren geen locatiegeschiedenis.
          </li>
          <li>
            <strong>Technisch:</strong> minimale loggegevens (zoals IP en sessie) om de dienst te
            laten werken en misbruik tegen te gaan.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Waarom we ze verwerken">
        <p>
          Om je in te laten loggen, je bijdragen te tonen en toe te schrijven, het
          community-verificatiemodel te laten werken (stemmen wegen mee op basis van reputatie), en
          de kaart en lijst te kunnen tonen. De wettelijke grondslag is de uitvoering van de
          overeenkomst (je gebruik van de app) en ons gerechtvaardigd belang om de dienst veilig en
          werkend te houden.
        </p>
      </LegalSection>

      <LegalSection heading="Diensten van derden">
        <p>
          We delen gegevens alleen met verwerkers die nodig zijn om de app te laten werken: e-mail
          (Resend) voor inloglinks, opslag (S3) voor foto&apos;s, en Apple/Google voor inloggen als
          je daarvoor kiest. Kaartmateriaal wordt geleverd door de kaartaanbieder van je toestel.
          Deze partijen mogen je gegevens niet voor eigen doeleinden gebruiken.
        </p>
      </LegalSection>

      <LegalSection heading="Bewaartermijn">
        <p>
          We bewaren je gegevens zolang je een account hebt. Publieke bijdragen (plekken, reviews)
          kunnen zichtbaar blijven nadat je je account verwijdert, maar worden dan losgekoppeld van
          je persoonsgegevens.
        </p>
      </LegalSection>

      <LegalSection heading="Je rechten">
        <p>
          Je hebt recht op inzage, correctie, verwijdering en overdracht van je gegevens, en je kunt
          bezwaar maken tegen verwerking. Mail ons en we regelen het. Je kunt ook een klacht
          indienen bij de Autoriteit Persoonsgegevens.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
