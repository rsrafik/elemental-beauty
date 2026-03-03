function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatInlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#c50000] underline underline-offset-4">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-black/5 px-1.5 py-0.5 text-[0.92em]">$1</code>');
}

export function renderMarkdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }

    html.push(`<p>${formatInlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const flushLists = () => {
    if (listItems.length > 0) {
      html.push(`<ul>${listItems.join('')}</ul>`);
      listItems = [];
    }

    if (orderedItems.length > 0) {
      html.push(`<ol>${orderedItems.join('')}</ol>`);
      orderedItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushLists();
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      flushLists();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      listItems.push(`<li>${formatInlineMarkdown(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      orderedItems.push(`<li>${formatInlineMarkdown(orderedMatch[1])}</li>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph();
      flushLists();
      html.push(`<blockquote>${formatInlineMarkdown(quoteMatch[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushLists();

  return html.join('');
}
