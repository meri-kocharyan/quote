// Utility functions for quote parsing and name replacement

export interface ParsedQuote {
  raw_text: string;
  lines: QuoteLine[];
  speakers: string[]; // unique speakers in order of first appearance
  placeholderSpeakers: string[]; // speakers that are generic placeholders (person a, person b, etc.)
  speaker_count: number;
}

export interface QuoteLine {
  speaker: string | null; // null for narration without a speaker label
  text: string; // the full line text
  isNarration: boolean;
}

const PLACEHOLDER_PATTERN = /^person\s+([a-z])$/i;

export function isPlaceholderName(name: string): boolean {
  return PLACEHOLDER_PATTERN.test(name.trim());
}

export function normalizePlaceholder(name: string): string {
  const match = name.trim().match(PLACEHOLDER_PATTERN);
  if (match) {
    return `person ${match[1].toLowerCase()}`;
  }
  return name.trim();
}

export function parseQuoteText(raw: string): ParsedQuote {
  const lines = raw.split('\n').filter(l => l.trim() !== '');
  const parsedLines: QuoteLine[] = [];
  const speakerSet = new Set<string>();
  const speakersOrdered: string[] = [];

  for (const line of lines) {
    // Try to detect "SpeakerName:" or "SpeakerName, action:" pattern
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const beforeColon = line.substring(0, colonIndex).trim();
      // Extract the speaker name (could be "Name, doing something")
      const commaIndex = beforeColon.indexOf(',');
      const speakerName = commaIndex > 0 ? beforeColon.substring(0, commaIndex).trim() : beforeColon;
      
      const normalizedSpeaker = isPlaceholderName(speakerName) ? normalizePlaceholder(speakerName) : speakerName;
      
      if (!speakerSet.has(normalizedSpeaker.toLowerCase())) {
        speakerSet.add(normalizedSpeaker.toLowerCase());
        speakersOrdered.push(normalizedSpeaker);
      }
      
      parsedLines.push({
        speaker: normalizedSpeaker,
        text: line,
        isNarration: false,
      });
    } else {
      // Narration line
      parsedLines.push({
        speaker: null,
        text: line,
        isNarration: true,
      });
    }
  }

  const placeholderSpeakers = speakersOrdered.filter(s => isPlaceholderName(s));

  return {
    raw_text: raw,
    lines: parsedLines,
    speakers: speakersOrdered,
    placeholderSpeakers,
    speaker_count: speakersOrdered.length,
  };
}

export function replaceNamesInText(text: string, replacements: Map<string, string>): string {
  let result = text;
  // Sort by length descending to avoid partial matches
  const entries = Array.from(replacements.entries()).sort((a, b) => b[0].length - a[0].length);
  
  for (const [placeholder, replacement] of entries) {
    // Token-based replacement: case-insensitive, whole token
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    result = result.replace(regex, replacement);
  }
  return result;
}

export function buildReplacementMap(userNames: string[], placeholderSpeakers: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < Math.min(userNames.length, placeholderSpeakers.length); i++) {
    if (userNames[i].trim()) {
      map.set(placeholderSpeakers[i], userNames[i].trim());
    }
  }
  return map;
}

export function formatQuoteForDisplay(raw: string, userNames: string[]): string {
  const parsed = parseQuoteText(raw);
  const replacements = buildReplacementMap(userNames, parsed.placeholderSpeakers);
  
  const lines = raw.split('\n').filter(l => l.trim() !== '');
  return lines.map(line => replaceNamesInText(line, replacements)).join('\n');
}

export function getDisplayLines(raw: string, userNames: string[]): { speaker: string | null; text: string }[] {
  const parsed = parseQuoteText(raw);
  const replacements = buildReplacementMap(userNames, parsed.placeholderSpeakers);
  
  const lines = raw.split('\n').filter(l => l.trim() !== '');
  return lines.map(line => {
    const replaced = replaceNamesInText(line, replacements);
    const colonIdx = replaced.indexOf(':');
    if (colonIdx > 0) {
      const beforeColon = replaced.substring(0, colonIdx);
      const afterColon = replaced.substring(colonIdx + 1);
      return { speaker: beforeColon, text: afterColon };
    }
    return { speaker: null, text: replaced };
  });
}
