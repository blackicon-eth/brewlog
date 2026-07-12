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

export function parseMarkdownLite(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) { blocks.push({ type: "heading", spans: parseSpans(heading[1]) }); continue; }

    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) { blocks.push({ type: "bullet", spans: parseSpans(bullet[1]) }); continue; }

    const ordered = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (ordered) { blocks.push({ type: "ordered", marker: ordered[1], spans: parseSpans(ordered[2]) }); continue; }

    // Models often shout a section title as a lone bold line — read it as a heading.
    const boldLine = line.match(/^\*\*(.+?):?\*\*:?$/);
    if (boldLine) { blocks.push({ type: "heading", spans: [{ text: boldLine[1] }] }); continue; }

    blocks.push({ type: "para", spans: parseSpans(line) });
  }
  return blocks;
}
