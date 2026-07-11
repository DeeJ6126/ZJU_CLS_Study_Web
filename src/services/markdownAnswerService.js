function flushParagraph(blocks, lines) {
  if (!lines.length) {
    return;
  }
  blocks.push({ type: 'paragraph', text: lines.join('\n').trim() });
  lines.length = 0;
}

function flushList(blocks, state) {
  if (!state.items.length) {
    return;
  }
  blocks.push({
    type: 'list',
    ordered: state.ordered,
    items: [...state.items],
  });
  state.items.length = 0;
  state.ordered = false;
}

export function parseMarkdownAnswer(markdownText) {
  const text = String(markdownText ?? '').trim();
  if (!text) {
    return [];
  }

  const blocks = [];
  const paragraphLines = [];
  const listState = { ordered: false, items: [] };
  let codeLines = [];
  let isCodeBlock = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith('```')) {
      if (isCodeBlock) {
        blocks.push({ type: 'code', text: codeLines.join('\n') });
        codeLines = [];
        isCodeBlock = false;
      } else {
        flushParagraph(blocks, paragraphLines);
        flushList(blocks, listState);
        isCodeBlock = true;
      }
      continue;
    }

    if (isCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (!line.trim()) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listState);
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph(blocks, paragraphLines);
      flushList(blocks, listState);
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      continue;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.+)$/);
    const orderedMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph(blocks, paragraphLines);
      const ordered = Boolean(orderedMatch);
      if (listState.items.length && listState.ordered !== ordered) {
        flushList(blocks, listState);
      }
      listState.ordered = ordered;
      listState.items.push((unorderedMatch?.[1] ?? orderedMatch?.[1] ?? '').trim());
      continue;
    }

    flushList(blocks, listState);
    paragraphLines.push(line.trim());
  }

  if (isCodeBlock) {
    blocks.push({ type: 'code', text: codeLines.join('\n') });
  }
  flushParagraph(blocks, paragraphLines);
  flushList(blocks, listState);

  return blocks;
}
