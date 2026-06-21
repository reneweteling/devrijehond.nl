/**
 * Lightweight rich-text renderer for the constrained HTML subset stored in
 * spot descriptions: p, br, strong/b, em/i, u, s, a[href], h3, ul, ol, li,
 * blockquote. No external deps — just React Native Text/View.
 */

import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, space } from '@/lib/theme';

// ─── Entity decoder ───────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(s: string): string {
  return s.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

// ─── Tokeniser ────────────────────────────────────────────────────────────────

type TagToken = { kind: 'open' | 'close'; tag: string; attrs: Record<string, string> };
type TextToken = { kind: 'text'; value: string };
type Token = TagToken | TextToken;

const ATTR_RE = /(\w[\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    const key = m[1];
    if (key) out[key.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

function tokenise(html: string): Token[] {
  const tokens: Token[] = [];
  // Split on tags — keeps tag text in odd indices.
  const parts = html.split(/(<[^>]*>)/);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('<')) {
      const inner = part.slice(1, -1).trim();
      if (inner.startsWith('/')) {
        tokens.push({ kind: 'close', tag: inner.slice(1).trim().toLowerCase(), attrs: {} });
      } else {
        // Self-closing or open
        const selfClose = inner.endsWith('/');
        const body = selfClose ? inner.slice(0, -1).trim() : inner;
        const spaceIdx = body.search(/\s/);
        const tag = (spaceIdx === -1 ? body : body.slice(0, spaceIdx)).toLowerCase();
        const attrStr = spaceIdx === -1 ? '' : body.slice(spaceIdx + 1);
        tokens.push({ kind: 'open', tag, attrs: parseAttrs(attrStr) });
        if (selfClose || tag === 'br') {
          tokens.push({ kind: 'close', tag, attrs: {} });
        }
      }
    } else {
      tokens.push({ kind: 'text', value: decodeEntities(part) });
    }
  }
  return tokens;
}

// ─── AST ──────────────────────────────────────────────────────────────────────

type TextNode = { type: 'text'; value: string };
type ElementNode = {
  type: 'element';
  tag: string;
  attrs: Record<string, string>;
  children: AstNode[];
};
type AstNode = TextNode | ElementNode;

function buildAst(tokens: Token[]): AstNode[] {
  const root: AstNode[] = [];
  const stack: { tag: string; attrs: Record<string, string>; children: AstNode[] }[] = [];

  function current() {
    return stack[stack.length - 1]!;
  }
  function append(n: AstNode) {
    if (stack.length === 0) {
      root.push(n);
    } else {
      current().children.push(n);
    }
  }

  for (const tok of tokens) {
    if (tok.kind === 'text') {
      append({ type: 'text', value: tok.value });
    } else if (tok.kind === 'open') {
      const node = { tag: tok.tag, attrs: tok.attrs, children: [] };
      if (tok.tag === 'br') {
        // br is void — emit as a text newline rather than pushing a frame
        append({ type: 'text', value: '\n' });
      } else {
        stack.push(node);
      }
    } else if (tok.kind === 'close') {
      if (tok.tag === 'br') continue;
      // Pop up to the matching tag (tolerates missing closes for inline tags)
      let found = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.tag === tok.tag) {
          found = i;
          break;
        }
      }
      if (found === -1) continue; // Stray close — ignore
      while (stack.length > found + 1) {
        const orphan = stack.pop()!;
        const el: AstNode = {
          type: 'element',
          tag: orphan.tag,
          attrs: orphan.attrs,
          children: orphan.children,
        };
        if (stack.length === 0) root.push(el);
        else current()!.children.push(el);
      }
      const closed = stack.pop()!;
      const el: AstNode = {
        type: 'element',
        tag: closed.tag,
        attrs: closed.attrs,
        children: closed.children,
      };
      append(el);
    }
  }
  // Flush anything still open
  while (stack.length > 0) {
    const unclosed = stack.pop()!;
    const el: AstNode = {
      type: 'element',
      tag: unclosed.tag,
      attrs: unclosed.attrs,
      children: unclosed.children,
    };
    if (stack.length === 0) root.push(el);
    else current()!.children.push(el);
  }
  return root;
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

// Inline marks that nest inside block elements.
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'a', 'span']);
// Block-level tags we handle explicitly.
const BLOCK_TAGS = new Set(['p', 'h3', 'ul', 'ol', 'li', 'blockquote', 'div']);

type InlineStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  href?: string;
};

/**
 * Renders a list of AST nodes as React Native inline Text fragments.
 * Handles strong/b, em/i, u, s, a.
 */
function renderInline(nodes: AstNode[], style: InlineStyle, key: string): React.ReactNode {
  return nodes.map((node, i) => {
    const k = `${key}-${i}`;
    if (node.type === 'text') {
      return renderLeaf(node.value, style, k);
    }
    const { tag, attrs, children } = node;
    if (tag === 'strong' || tag === 'b') {
      return renderInline(children, { ...style, bold: true }, k);
    }
    if (tag === 'em' || tag === 'i') {
      return renderInline(children, { ...style, italic: true }, k);
    }
    if (tag === 'u') {
      return renderInline(children, { ...style, underline: true }, k);
    }
    if (tag === 's') {
      return renderInline(children, { ...style, strikethrough: true }, k);
    }
    if (tag === 'a') {
      return renderInline(children, { ...style, href: attrs['href'] ?? '' }, k);
    }
    // Any other inline or block nested here — just recurse without extra marks
    if (BLOCK_TAGS.has(tag)) {
      return renderInline(children, style, k);
    }
    return renderInline(children, style, k);
  });
}

function renderLeaf(value: string, style: InlineStyle, key: string): React.ReactNode {
  const ts: object[] = [styles.bodyText];
  if (style.bold) ts.push(styles.bold);
  if (style.italic) ts.push(styles.italic);
  if (style.underline && style.strikethrough) ts.push(styles.underlineThrough);
  else if (style.underline) ts.push(styles.underline);
  else if (style.strikethrough) ts.push(styles.strikethrough);
  if (style.href) ts.push(styles.link);

  if (style.href) {
    const href = style.href;
    return (
      <Pressable key={key} onPress={() => void Linking.openURL(href)} style={styles.inlinePress}>
        <Text style={ts}>{value}</Text>
      </Pressable>
    );
  }
  return (
    <Text key={key} style={ts}>
      {value}
    </Text>
  );
}

/**
 * Renders a block-level node as a View/Text pair.
 */
function renderBlock(
  node: AstNode,
  index: number,
  listCounterRef: { value: number },
): React.ReactNode {
  if (node.type === 'text') {
    const trimmed = node.value.replace(/\n/g, '').trim();
    if (!trimmed) return null;
    return (
      <Text key={`t-${index}`} style={styles.bodyText}>
        {trimmed}
      </Text>
    );
  }

  const { tag, children } = node;
  const k = `b-${index}`;

  if (tag === 'p' || tag === 'div') {
    return (
      <Text key={k} style={styles.paragraph}>
        {renderInline(children, {}, k)}
      </Text>
    );
  }

  if (tag === 'h3') {
    return (
      <Text key={k} style={styles.heading}>
        {renderInline(children, {}, k)}
      </Text>
    );
  }

  if (tag === 'blockquote') {
    return (
      <View key={k} style={styles.blockquote}>
        <Text style={styles.blockquoteText}>{renderInline(children, {}, k)}</Text>
      </View>
    );
  }

  if (tag === 'ul') {
    return (
      <View key={k} style={styles.list}>
        {children
          .filter((c): c is ElementNode => c.type === 'element' && c.tag === 'li')
          .map((li, i) => (
            <View key={`${k}-li-${i}`} style={styles.listItem}>
              <Text style={styles.bullet}>{'•'}</Text>
              <Text style={styles.listItemText}>
                {renderInline(li.children, {}, `${k}-li-${i}`)}
              </Text>
            </View>
          ))}
      </View>
    );
  }

  if (tag === 'ol') {
    return (
      <View key={k} style={styles.list}>
        {children
          .filter((c): c is ElementNode => c.type === 'element' && c.tag === 'li')
          .map((li, i) => (
            <View key={`${k}-li-${i}`} style={styles.listItem}>
              <Text style={styles.bullet}>{i + 1}.</Text>
              <Text style={styles.listItemText}>
                {renderInline(li.children, {}, `${k}-li-${i}`)}
              </Text>
            </View>
          ))}
      </View>
    );
  }

  if (tag === 'li') {
    // Standalone li outside ul/ol — render as bullet
    return (
      <View key={k} style={styles.listItem}>
        <Text style={styles.bullet}>{'•'}</Text>
        <Text style={styles.listItemText}>{renderInline(children, {}, k)}</Text>
      </View>
    );
  }

  // Inline tags at top level — wrap in a paragraph
  if (INLINE_TAGS.has(tag)) {
    return (
      <Text key={k} style={styles.paragraph}>
        {renderInline([node], {}, k)}
      </Text>
    );
  }

  // Unknown block — recurse
  return <View key={k}>{children.map((child, ci) => renderBlock(child, ci, listCounterRef))}</View>;
}

// ─── Public component ─────────────────────────────────────────────────────────

/** True when the string contains at least one HTML tag. */
function hasHtmlTags(s: string): boolean {
  return /<[a-z/]/i.test(s);
}

export function RichText({ html }: { html: string | null | undefined }) {
  if (!html) return null;

  // Plain text — no parsing needed
  if (!hasHtmlTags(html)) {
    return <Text style={styles.paragraph}>{decodeEntities(html)}</Text>;
  }

  let blocks: React.ReactNode[];
  try {
    const tokens = tokenise(html);
    const ast = buildAst(tokens);
    const counterRef = { value: 0 };
    blocks = ast.map((node, i) => renderBlock(node, i, counterRef));
  } catch {
    // Fallback: strip all tags and render as plain text
    const plain = html.replace(/<[^>]*>/g, '');
    return <Text style={styles.paragraph}>{decodeEntities(plain)}</Text>;
  }

  return <View style={styles.root}>{blocks}</View>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { gap: 0 },
  paragraph: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    marginBottom: space.sm,
  },
  heading: {
    fontFamily: font.heading,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: space.xs,
    marginTop: space.sm,
  },
  bodyText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
  },
  bold: { fontFamily: font.bodyMedium },
  italic: { fontStyle: 'italic' },
  underline: { textDecorationLine: 'underline' },
  strikethrough: { textDecorationLine: 'line-through' },
  underlineThrough: { textDecorationLine: 'underline line-through' },
  link: { color: colors.moss },
  inlinePress: { display: 'flex' },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.moss,
    paddingLeft: space.md,
    marginVertical: space.xs,
    backgroundColor: colors.mossSoft,
    borderRadius: 4,
    paddingVertical: space.xs,
  },
  blockquoteText: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.ink2,
    fontStyle: 'italic',
  },
  list: { gap: 4, marginBottom: space.sm },
  listItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  bullet: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    minWidth: 16,
  },
  listItemText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
  },
});
