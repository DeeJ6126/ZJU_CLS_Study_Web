function normalizeValue(value) {
  const trimmed = value.trim();

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function parseMarkdownDocument(markdownText) {
  const match = markdownText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);

  if (!match) {
    return {
      frontmatter: {},
      body: markdownText.trim(),
    };
  }

  const frontmatter = {};
  const lines = match[1].split(/\r?\n/);

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1);
    frontmatter[key] = normalizeValue(value);
  }

  return {
    frontmatter,
    body: match[2].trim(),
  };
}

export function splitPipeList(value = '') {
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitTimeline(value = '') {
  return splitPipeList(value).map((item) => {
    const separatorIndex = item.indexOf('：');

    if (separatorIndex === -1) {
      return { title: item, text: '' };
    }

    return {
      title: item.slice(0, separatorIndex),
      text: item.slice(separatorIndex + 1),
    };
  });
}

export function bodyToParagraphs(body = '') {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export async function fetchMarkdownDocument(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load markdown: ${url}`);
  }

  return parseMarkdownDocument(await response.text());
}
