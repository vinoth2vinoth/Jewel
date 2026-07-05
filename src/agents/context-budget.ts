const TRUNCATION_MARKER = '\n[... truncated by Jewel context budget ...]\n';
const FILE_HEADER_RE = /^=== File: (.+) ===$/;

export const DEFAULT_PROMPT_CONTEXT_MAX_CHARS = 120_000;

interface ContextFileBlock {
  filePath: string;
  header: string;
  body: string;
}

function parseFileBlocks(repoContext: string): ContextFileBlock[] {
  const blocks: ContextFileBlock[] = [];
  const lines = repoContext.split('\n');
  let current: ContextFileBlock | null = null;
  const bodyLines: string[] = [];

  const flush = () => {
    if (current) {
      current.body = bodyLines.join('\n');
      blocks.push(current);
      bodyLines.length = 0;
    }
  };

  for (const line of lines) {
    const match = line.match(FILE_HEADER_RE);
    if (match) {
      flush();
      current = { filePath: match[1], header: line, body: '' };
    } else if (current) {
      bodyLines.push(line);
    }
  }
  flush();
  return blocks;
}

function truncateMiddle(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const budget = Math.max(maxChars - TRUNCATION_MARKER.length, 200);
  const headChars = Math.floor(budget * 0.7);
  const tailChars = budget - headChars;
  return text.slice(0, headChars) + TRUNCATION_MARKER + text.slice(text.length - tailChars);
}

/**
 * Compact a repo context string (concatenated "=== File: x ===" blocks) to a
 * character budget. Files are assumed to be ordered most-relevant first (the
 * discovery ranking), so later files lose content first: each file gets a
 * shrinking share of the remaining budget, and files that cannot fit at all
 * are replaced by a stub so the model still knows they exist.
 */
export function compactRepoContext(repoContext: string, maxChars: number = DEFAULT_PROMPT_CONTEXT_MAX_CHARS): string {
  if (repoContext.length <= maxChars) return repoContext;

  const blocks = parseFileBlocks(repoContext);
  if (blocks.length === 0) {
    return truncateMiddle(repoContext, maxChars);
  }

  const pieces: string[] = [];
  let remaining = maxChars;
  const stub = '(content omitted by Jewel context budget — ask for this file if needed)';

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const overhead = block.header.length + 2;
    const stubBlock = `${block.header}\n${stub}\n`;

    if (remaining <= stubBlock.length) {
      pieces.push(stubBlock);
      remaining -= stubBlock.length;
      continue;
    }

    const fullSize = overhead + block.body.length;
    if (fullSize <= remaining) {
      // Reserve stub space for the remaining files so none disappear entirely
      const reserve = (blocks.length - i - 1) * (stub.length + 40);
      if (fullSize <= remaining - reserve) {
        pieces.push(`${block.header}\n${block.body}\n`);
        remaining -= fullSize;
        continue;
      }
    }

    const reserve = (blocks.length - i - 1) * (stub.length + 40);
    const bodyBudget = Math.max(remaining - overhead - reserve, 200);
    const truncatedBody = truncateMiddle(block.body, bodyBudget);
    pieces.push(`${block.header}\n${truncatedBody}\n`);
    remaining -= overhead + truncatedBody.length;
  }

  return pieces.join('\n');
}

/**
 * Compact free-form text (e.g. repoSummary) keeping the beginning (project
 * structure) and the end (most recently appended context like exploration
 * results and continuation feedback).
 */
export function compactSummaryText(text: string, maxChars: number = DEFAULT_PROMPT_CONTEXT_MAX_CHARS): string {
  return truncateMiddle(text, maxChars);
}
