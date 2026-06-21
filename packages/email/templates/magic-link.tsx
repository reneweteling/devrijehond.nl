/**
 * Magic-link email template (React Email).
 *
 * The CTA href is always a plain HTTPS URL, `@devrijehond/auth` rewrites any
 * mobile deep link to an HTTPS interstitial before it reaches here, so Gmail /
 * Outlook / Yahoo never see a custom scheme to strip.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface MagicLinkEmailProps {
  /** The (already-rewritten) HTTPS link the user clicks to sign in. */
  url: string;
}

const brandGreen = '#2f4a36'; // "Aarde & bos" deep forest green
const textColor = '#1c1c1c';
const muted = '#6b7280';

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html lang="nl">
      <Head />
      <Preview>Je inloglink voor De Vrije Hond</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>De Vrije Hond</Heading>
          <Text style={paragraph}>Hoi,</Text>
          <Text style={paragraph}>
            Klik op de knop hieronder om in te loggen. Deze link is 5 minuten geldig en kan maar één
            keer gebruikt worden.
          </Text>
          <Section style={buttonWrapper}>
            <Button style={button} href={url}>
              Inloggen
            </Button>
          </Section>
          <Text style={paragraph}>Werkt de knop niet? Kopieer dan deze link naar je browser:</Text>
          <Link style={link} href={url}>
            {url}
          </Link>
          <Text style={footer}>
            Heb je niet om deze e-mail gevraagd? Dan kun je hem veilig negeren.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Sample data so the React Email preview (pnpm dev → :3031) can render this
// template without a real link.
MagicLinkEmail.PreviewProps = {
  url: 'https://www.devrijehond.nl/verify-mobile?token=preview-token',
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;

const body: React.CSSProperties = {
  backgroundColor: '#f4f3ee',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '32px 24px',
  maxWidth: '480px',
  backgroundColor: '#ffffff',
  borderRadius: '12px',
};

const heading: React.CSSProperties = {
  color: brandGreen,
  fontSize: '24px',
  fontWeight: 700,
  margin: '0 0 16px',
};

const paragraph: React.CSSProperties = {
  color: textColor,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const buttonWrapper: React.CSSProperties = {
  margin: '24px 0',
};

const button: React.CSSProperties = {
  backgroundColor: brandGreen,
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '8px',
  display: 'inline-block',
};

const link: React.CSSProperties = {
  color: brandGreen,
  fontSize: '13px',
  wordBreak: 'break-all',
};

const footer: React.CSSProperties = {
  color: muted,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '24px 0 0',
};
