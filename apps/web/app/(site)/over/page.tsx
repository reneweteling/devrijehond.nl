import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '../legal';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Over & meebouwen',
  description:
    'Wie De Vrije Hond maakt, waar de open-source code staat en hoe je meebouwt of contact opneemt.',
};

const REPO = 'https://github.com/reneweteling/devrijehond.nl';

export default function OverPage() {
  return (
    <LegalPage title="Over De Vrije Hond" updated="20 juni 2026">
      <p>
        De Vrije Hond is een community-kaart van hondvriendelijke plekken in Nederland:
        losloopgebieden, hondenstranden, hondvriendelijke horeca, waterpunten en meer. Toegevoegd en
        geverifieerd door hondenbazen zelf.
      </p>

      <LegalSection heading="Gemaakt door">
        <p>
          De Vrije Hond is gemaakt door{' '}
          <a href="https://www.weteling.com" target="_blank" rel="noreferrer">
            René Weteling
          </a>{' '}
          (Felobo B.V.), uit liefde voor honden en mooie wandelingen. Van idee tot productie: web,
          mobiel en AI.
        </p>
      </LegalSection>

      <LegalSection heading="Open source, bouw mee">
        <p>
          De code is openbaar. Heb je een idee, vind je een bug, of wil je een plek-bron toevoegen?
          Je bent welkom om mee te bouwen.
        </p>
        <ul>
          <li>
            Repository:{' '}
            <a href={REPO} target="_blank" rel="noreferrer">
              github.com/reneweteling/devrijehond.nl
            </a>
          </li>
          <li>
            Een verbetering?{' '}
            <a href={`${REPO}/pulls`} target="_blank" rel="noreferrer">
              Open een pull request
            </a>
            .
          </li>
          <li>
            Een bug of idee?{' '}
            <a href={`${REPO}/issues/new`} target="_blank" rel="noreferrer">
              Maak een issue aan
            </a>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Vragen, samenwerken of gewoon hallo zeggen? Mail naar{' '}
          <a href="mailto:info@devrijehond.nl">info@devrijehond.nl</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
