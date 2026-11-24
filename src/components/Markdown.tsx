/* A small, safe Markdown renderer for KROOPY AI answers: headings, paragraphs, lists, quotes, code,
   **bold**, *italic*, `code` and links. It builds React elements — never raw HTML — so nothing in a
   reply can inject markup or scripts. */
import { Fragment, type ReactNode } from 'react';

function inline(raw: string, key = 0): ReactNode[] {
  // a quote marker left in the middle of a line ("Voice-over: > «…»") is noise, not formatting
  const text = raw.replace(/(^|[:—–-]\s*)>\s+(?=\S)/g, '$1');
  const out: ReactNode[] = [];
  // order matters: code first (its content is literal), then links, bold, italic
  const re = /(`[^`]+`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*\s][^*]*)\*)|(_([^_\s][^_]*)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k}>{m[1].slice(1, -1)}</code>);
    else if (m[2]) out.push(<a key={k} href={m[4]} target="_blank" rel="noopener noreferrer">{m[3]}</a>);
    else if (m[5]) out.push(<strong key={k}>{inline(m[6]!, i)}</strong>);
    else if (m[7]) out.push(<em key={k}>{m[8]}</em>);
    else if (m[9]) out.push(<em key={k}>{m[10]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'quote'; text: string }
  | { t: 'code'; text: string }
  | { t: 'hr' };

function parse(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ t: 'p', text: para.join('\n') });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^```/.test(line)) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !/^```/.test(lines[i]!)) code.push(lines[i]!);
      blocks.push({ t: 'code', text: code.join('\n') });
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ t: 'h', level: h[1]!.length, text: h[2]! });
      continue;
    }
    if (/^\s*(?:-\s*){3,}$|^\s*(?:\*\s*){3,}$|^\s*(?:_\s*){3,}$/.test(line)) {
      flush();
      blocks.push({ t: 'hr' });
      continue;
    }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flush();
      const kind = ul ? 'ul' : 'ol';
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === kind) prev.items.push((ul ?? ol)![1]!);
      else blocks.push({ t: kind, items: [(ul ?? ol)![1]!] });
      continue;
    }
    const q = line.match(/^>\s?(.*)$/);
    if (q) {
      flush();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.t === 'quote') prev.text += `\n${q[1]}`;
      else blocks.push({ t: 'quote', text: q[1]! });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    // a line that continues a list item (indented) joins it
    const prev = blocks[blocks.length - 1];
    if (!para.length && prev && (prev.t === 'ul' || prev.t === 'ol') && /^\s{2,}\S/.test(line)) {
      prev.items[prev.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}

const withBreaks = (text: string, key: number) =>
  text.split('\n').map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {inline(l, key * 100 + i)}
    </Fragment>
  ));

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      {parse(text).map((b, i) => {
        switch (b.t) {
          case 'h': {
            const Tag = (b.level <= 2 ? 'h3' : 'h4') as 'h3' | 'h4';
            return <Tag key={i}>{inline(b.text, i)}</Tag>;
          }
          case 'ul':
            return <ul key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, i * 100 + j)}</li>)}</ul>;
          case 'ol':
            return <ol key={i}>{b.items.map((it, j) => <li key={j}>{inline(it, i * 100 + j)}</li>)}</ol>;
          case 'quote':
            return <blockquote key={i}>{withBreaks(b.text, i)}</blockquote>;
          case 'code':
            return <pre key={i}><code>{b.text}</code></pre>;
          case 'hr':
            return <hr key={i} />;
          default:
            return <p key={i}>{withBreaks(b.text, i)}</p>;
        }
      })}
    </div>
  );
}
