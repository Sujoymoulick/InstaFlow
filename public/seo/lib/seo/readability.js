/**
 * Instaflow SEO Suite - Readability & Text Statistics
 * Implements Flesch-Kincaid, Gunning Fog, Coleman-Liau, SMOG formulas
 */

export function countSyllables(word) {
  if (!word) return 0;
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  
  // Basic syllable heuristic
  let clean = w.replace(/(?:[^laeiouy]|ed|es|e)$/, '')
               .replace(/^y/, '');
  const matches = clean.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

export function analyzeText(text = '') {
  if (!text || typeof text !== 'string') {
    return {
      wordCount: 0,
      sentenceCount: 0,
      characterCount: 0,
      syllableCount: 0,
      complexWordCount: 0,
      fleschReadingEase: 0,
      fleschKincaidGrade: 0,
      gunningFog: 0,
      colemanLiau: 0,
      readingTimeMinutes: 0
    };
  }

  const clean = text.trim();
  const words = clean.match(/[\p{L}\p{N}_-]+/gu) || [];
  const sentences = clean.split(/[.!?]+(?:\s+|$)/).filter(s => s.trim().length > 0);
  const characterCount = clean.replace(/\s+/g, '').length;

  const wordCount = Math.max(1, words.length);
  const sentenceCount = Math.max(1, sentences.length);

  let syllableCount = 0;
  let complexWordCount = 0;

  for (const word of words) {
    const syl = countSyllables(word);
    syllableCount += syl;
    if (syl >= 3) {
      complexWordCount++;
    }
  }

  // Flesch Reading Ease: 206.835 - 1.015 * (total_words / total_sentences) - 84.6 * (total_syllables / total_words)
  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllableCount / wordCount;
  const rawEase = 206.835 - (1.015 * wordsPerSentence) - (84.6 * syllablesPerWord);
  const fleschReadingEase = Math.max(0, Math.min(100, Math.round(rawEase * 10) / 10));

  // Flesch-Kincaid Grade Level: 0.39 * (total_words / total_sentences) + 11.8 * (total_syllables / total_words) - 15.59
  const rawGrade = (0.39 * wordsPerSentence) + (11.8 * syllablesPerWord) - 15.59;
  const fleschKincaidGrade = Math.max(0, Math.round(rawGrade * 10) / 10);

  // Gunning Fog Index: 0.4 * ((words / sentences) + 100 * (complex_words / words))
  const complexWordPct = (complexWordCount / wordCount) * 100;
  const rawFog = 0.4 * (wordsPerSentence + complexWordPct);
  const gunningFog = Math.max(0, Math.round(rawFog * 10) / 10);

  // Coleman-Liau: 0.0588 * L - 0.296 * S - 15.8 (L = avg letters per 100 words, S = avg sentences per 100 words)
  const L = (characterCount / wordCount) * 100;
  const S = (sentenceCount / wordCount) * 100;
  const rawColeman = (0.0588 * L) - (0.296 * S) - 15.8;
  const colemanLiau = Math.max(0, Math.round(rawColeman * 10) / 10);

  // Reading time (approx 200 words per minute)
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    characterCount,
    syllableCount,
    complexWordCount,
    wordsPerSentence: Math.round(wordsPerSentence * 10) / 10,
    fleschReadingEase,
    fleschKincaidGrade,
    gunningFog,
    colemanLiau,
    readingTimeMinutes,
    easeRating: getEaseRating(fleschReadingEase)
  };
}

function getEaseRating(score) {
  if (score >= 90) return 'Very Easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly Easy (7th grade)';
  if (score >= 60) return 'Standard (8th-9th grade)';
  if (score >= 50) return 'Fairly Difficult (10th-12th grade)';
  if (score >= 30) return 'Difficult (College)';
  return 'Very Difficult (College Graduate)';
}
