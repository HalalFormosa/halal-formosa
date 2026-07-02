export interface HalalifyPhrase {
  id?: number;
  category: string;
  catId: string;
  english: string;
  chinese: string;
  pinyin: string;
  pronunciation: string;
  translations: Record<string, string>;
  alignments?: ReadonlyArray<Record<string, string>>;
}

export const masterPhrases: HalalifyPhrase[] = [];
