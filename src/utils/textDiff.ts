// Per-token fuzzy-match threshold used INSIDE diffIngredientTokens to bucket
// OCR/translation noise ("Sodlum" vs "Sodium") as a close token match rather
// than a hard miss — unrelated to the overall match/close/mismatch verdict
// tiers below.
const TOKEN_FUZZY_MATCH_THRESHOLD = 0.85

// Overall similarity verdict tiers (used for both name and ingredients
// scores): green ≥ 80%, yellow 50-80%, red below 50%.
export const SIMILARITY_GREEN_THRESHOLD = 0.8
export const SIMILARITY_YELLOW_THRESHOLD = 0.5

export type SimilarityVerdict = 'match' | 'close' | 'mismatch'

export function verdictForSimilarity(score: number): SimilarityVerdict {
  if (score >= SIMILARITY_GREEN_THRESHOLD) return 'match'
  if (score >= SIMILARITY_YELLOW_THRESHOLD) return 'close'
  return 'mismatch'
}

// Self-contained Jaro-Winkler implementation — the `natural` npm package
// (listed in package.json but unused elsewhere) is a Node-oriented library
// that crashes when bundled for the browser ("Class extends value ... is not
// a constructor"), taking down unrelated routes with it. This avoids that
// dependency entirely; the algorithm itself is short and well-defined.
function jaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1
  if (!s1.length || !s2.length) return 0

  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1
  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  let matches = 0
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow)
    const end = Math.min(i + matchWindow + 1, s2.length)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0

  let transpositions = 0
  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3
}

function jaroWinklerDistance(s1: string, s2: string): number {
  const jaro = jaroDistance(s1, s2)
  let prefixLen = 0
  while (prefixLen < 4 && prefixLen < s1.length && prefixLen < s2.length && s1[prefixLen] === s2[prefixLen]) {
    prefixLen++
  }
  return jaro + prefixLen * 0.1 * (1 - jaro)
}

export interface CloseMatch {
  submitted: string
  ocr: string
  similarity: number
}

export interface IngredientTokenDiff {
  submittedTokens: string[]
  ocrTokens: string[]
  missingFromPhoto: string[]
  extraInPhoto: string[]
  closeMatches: CloseMatch[]
  matchedCount: number
  jaccard: number
}

function normalizeToken(s: string): string {
  return s.toLowerCase().trim().replace(/\.+$/, '').replace(/\s+/g, ' ')
}

function tokenize(text: string): string[] {
  return [...new Set(text.split(',').map(normalizeToken).filter(Boolean))]
}

// Ingredients are compared as an unordered token set (exact match first, then
// a fuzzy pass) rather than a whole-string score — OCR/translation noise
// ("Sodlum" vs "Sodium") would otherwise register as a hard miss on both
// sides, and the admin needs to see WHAT differs, not just a percentage.
export function diffIngredientTokens(submitted: string, ocr: string): IngredientTokenDiff {
  const submittedTokens = tokenize(submitted || '')
  const ocrTokens = tokenize(ocr || '')
  const ocrSet = new Set(ocrTokens)
  const submittedSet = new Set(submittedTokens)

  let missingFromPhoto = submittedTokens.filter(t => !ocrSet.has(t))
  let extraInPhoto = ocrTokens.filter(t => !submittedSet.has(t))

  const closeMatches: CloseMatch[] = []
  const stillMissing: string[] = []
  for (const submittedToken of missingFromPhoto) {
    let bestMatch: string | null = null
    let bestScore = 0
    for (const ocrToken of extraInPhoto) {
      const score = jaroWinklerDistance(submittedToken, ocrToken)
      if (score > bestScore) {
        bestScore = score
        bestMatch = ocrToken
      }
    }
    if (bestMatch && bestScore >= TOKEN_FUZZY_MATCH_THRESHOLD) {
      closeMatches.push({ submitted: submittedToken, ocr: bestMatch, similarity: bestScore })
      extraInPhoto = extraInPhoto.filter(t => t !== bestMatch)
    } else {
      stillMissing.push(submittedToken)
    }
  }
  missingFromPhoto = stillMissing

  const union = new Set([...submittedSet, ...ocrSet])
  const matchedCount = union.size - missingFromPhoto.length - extraInPhoto.length
  const jaccard = union.size === 0 ? 1 : matchedCount / union.size

  return { submittedTokens, ocrTokens, missingFromPhoto, extraInPhoto, closeMatches, matchedCount, jaccard }
}

export function nameSimilarity(a: string, b: string): number {
  const na = (a || '').toLowerCase().trim()
  const nb = (b || '').toLowerCase().trim()
  if (!na || !nb) return 0
  return jaroWinklerDistance(na, nb)
}
