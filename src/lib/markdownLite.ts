// A deliberately small markdown reader for the assistant's answers. On-device models
// emit a narrow dialect — #/## headings, **bold**, *italic*, `code`, "-" bullets and
// "1." numbered steps — so this parses exactly that and nothing more, and never throws
// on the half-finished markup that streaming produces (an unclosed **bold runs to the
// end of its line). Pure module: rendering lives in components/ui/MarkdownText.

export type Span = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { type: "heading"; spans: Span[] }
  | { type: "bullet"; spans: Span[] }
  | { type: "ordered"; marker: string; spans: Span[] }
  | { type: "para"; spans: Span[] };

// Inline pass: split a line into styled spans. Markers that never close simply style
// the rest of the line — mid-stream text settles into place once the closer arrives.
export function parseSpans(line: string): Span[] {
  const spans: Span[] = [];
  let i = 0;
  let plain = "";
  const flush = () => { if (plain) { spans.push({ text: plain }); plain = ""; } };

  while (i < line.length) {
    if (line.startsWith("**", i)) {
      const end = line.indexOf("**", i + 2);
      const inner = end === -1 ? line.slice(i + 2) : line.slice(i + 2, end);
      if (inner) { flush(); spans.push({ text: inner, bold: true }); }
      i = end === -1 ? line.length : end + 2;
      continue;
    }
    if (line[i] === "*" || line[i] === "_") {
      const mark = line[i];
      const end = line.indexOf(mark, i + 1);
      const inner = end === -1 ? line.slice(i + 1) : line.slice(i + 1, end);
      // A lone asterisk floating in prose (e.g. "2 * 3") stays literal.
      if (inner && !/^\s/.test(inner)) {
        flush(); spans.push({ text: inner, italic: true });
        i = end === -1 ? line.length : end + 1;
        continue;
      }
    }
    if (line[i] === "`") {
      const end = line.indexOf("`", i + 1);
      if (end !== -1) {
        flush(); spans.push({ text: line.slice(i + 1, end), code: true });
        i = end + 1;
        continue;
      }
    }
    plain += line[i];
    i++;
  }
  flush();
  return spans;
}

// One line → one block (or null for blank lines). Exposed so the renderer can work
// line-by-line: while streaming, settled lines are byte-identical between renders, and
// a memoized per-line component skips their re-parse AND their native re-measure.
export function parseBlock(raw: string): Block | null {
  const line = raw.trim();
  if (!line) return null;

  const heading = line.match(/^#{1,4}\s+(.*)$/);
  if (heading) return { type: "heading", spans: parseSpans(heading[1]) };

  const bullet = line.match(/^[-*•]\s+(.*)$/);
  if (bullet) return { type: "bullet", spans: parseSpans(bullet[1]) };

  const ordered = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
  if (ordered) return { type: "ordered", marker: ordered[1], spans: parseSpans(ordered[2]) };

  // Models often shout a section title as a lone bold line — read it as a heading.
  const boldLine = line.match(/^\*\*(.+?):?\*\*:?$/);
  if (boldLine) return { type: "heading", spans: [{ text: boldLine[1] }] };

  return { type: "para", spans: parseSpans(line) };
}

export function parseMarkdownLite(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const b = parseBlock(raw);
    if (b) blocks.push(b);
  }
  return blocks;
}

// Splits a growing plain-text stream into display chunks whose boundaries never move:
// greedy, left-to-right, decided only by content BEFORE each boundary — so re-chunking
// a longer text reproduces every earlier chunk byte-for-byte, and memoized chunk
// components stay frozen while only the tail grows. Android re-runs line-breaking over
// a whole Text node on every change; keeping settled prose in its own nodes is what
// makes a long streamed trace scrollable.
export function chunkPlainText(text: string, target = 500): string[] {
  const chunks: string[] = [];
  let current = "";
  const push = (piece: string) => {
    current = current ? `${current}\n${piece}` : piece;
    if (current.length >= target) { chunks.push(current); current = ""; }
  };
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    // A single run-on line longer than two targets gets hard-split at spaces; the cut
    // positions depend only on the line's own prefix, so they too are stable.
    let rest = line;
    while (rest.length > target * 2) {
      const cut = rest.lastIndexOf(" ", target);
      const at = cut > target / 2 ? cut : target;
      push(rest.slice(0, at).trimEnd());
      rest = rest.slice(at).trimStart();
    }
    push(rest);
  }
  if (current) chunks.push(current);
  return chunks;
}
