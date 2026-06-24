/**
 * Magic-link email template (React Email).
 *
 * The CTA href is always a plain HTTPS URL, `@devrijehond/auth` rewrites any
 * mobile deep link to an HTTPS interstitial before it reaches here, so Gmail /
 * Outlook / Yahoo never see a custom scheme to strip.
 *
 * Locked to a light color scheme so dark-mode mail clients don't invert the
 * brand palette.
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface MagicLinkEmailProps {
  /** The (already-rewritten) HTTPS link the user clicks to sign in. */
  url: string;
}

// De Vrije Hond brand palette (mirrors the app).
const moss = '#6E7B33';
const mossDark = '#4C5622';
const sand = '#F3EFE3';
const cream = '#FFFDF7';
const ink = '#2B3320';
const ink2 = '#5A6151';
const logoUrl = 'https://www.devrijehond.nl/logo.png';

export function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html lang="nl">
      <Head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light only" />
      </Head>
      <Preview>Je inloglink voor De Vrije Hond</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={{ textAlign: 'center' }}>
            <Img src={logoUrl} alt="De Vrije Hond" width="96" height="76" style={logo} />
          </Section>
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
  backgroundColor: sand,
  margin: 0,
  padding: '24px 0',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '32px 28px',
  maxWidth: '480px',
  backgroundColor: cream,
  borderRadius: '20px',
  border: '1px solid #ECE7D7',
};

const logo: React.CSSProperties = {
  margin: '0 auto 8px',
  display: 'block',
};

const heading: React.CSSProperties = {
  color: mossDark,
  fontSize: '24px',
  fontWeight: 700,
  textAlign: 'center',
  margin: '0 0 20px',
};

const paragraph: React.CSSProperties = {
  color: ink,
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

const buttonWrapper: React.CSSProperties = {
  margin: '24px 0',
  textAlign: 'center',
};

const button: React.CSSProperties = {
  backgroundColor: moss,
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 600,
  textDecoration: 'none',
  padding: '14px 28px',
  borderRadius: '12px',
  display: 'inline-block',
};

const link: React.CSSProperties = {
  color: moss,
  fontSize: '13px',
  wordBreak: 'break-all',
};

const footer: React.CSSProperties = {
  color: ink2,
  fontSize: '13px',
  lineHeight: '20px',
  margin: '24px 0 0',
};
