export const WORD_LISTS = {
  easy: [
    'APPLE', 'BANANA', 'ORANGE', 'GRAPE', 'LEMON',
    'HOUSE', 'CHAIR', 'TABLE', 'PHONE', 'PAPER',
    'WATER', 'LIGHT', 'MUSIC', 'HAPPY', 'SMILE',
    'PLANT', 'CLOUD', 'BEACH', 'STONE', 'GRASS',
    'BREAD', 'PIZZA', 'SALAD', 'PASTA', 'JUICE'
  ],
  medium: [
    'ADVENTURE', 'BALANCE', 'CALENDAR', 'DIAMOND', 'ELEPHANT',
    'FANTASY', 'GARDEN', 'HISTORY', 'ISLAND', 'JOURNEY',
    'KITCHEN', 'LIBRARY', 'MOUNTAIN', 'NETWORK', 'OCEAN',
    'PROBLEM', 'QUALITY', 'RAINBOW', 'SYSTEM', 'TRAVEL',
    'UMBRELLA', 'VICTORY', 'WEATHER', 'YELLOW', 'ZENITH'
  ],
  hard: [
    'ALGORITHM', 'BEAUTIFUL', 'CHOCOLATE', 'DICTIONARY', 'ENGINEERING',
    'FASCINATING', 'GENERATION', 'HORIZONTAL', 'IMAGINATION', 'JOURNALISM',
    'KNOWLEDGE', 'LIGHTNING', 'MYSTERIOUS', 'NAVIGATION', 'OPPORTUNITY',
    'PERSONALITY', 'QUARANTINE', 'RESTAURANT', 'STRAWBERRY', 'TECHNOLOGY',
    'UNDERSTAND', 'VOCABULARY', 'WATERMELON', 'XYLOPHONE', 'YESTERDAY'
  ],
  expert: [
    'ACCOMPLISHMENT', 'BIODIVERSITY', 'CRYPTOCURRENCY', 'DETERMINATION', 'EXTRAORDINARY',
    'PHILOSOPHICAL', 'QUESTIONNAIRE', 'REVOLUTIONARY', 'SOPHISTICATED', 'THERMODYNAMICS',
    'UNQUESTIONABLE', 'VULNERABILITY', 'WHOLEHEARTED', 'XENOPHOBIA', 'ZOOLOGICAL'
  ]
};

export const ALL_WORDS = [
  ...WORD_LISTS.easy,
  ...WORD_LISTS.medium,
  ...WORD_LISTS.hard,
  ...WORD_LISTS.expert
];

export function getRandomWord(difficulty?: 'easy' | 'medium' | 'hard' | 'expert'): string {
  const words = difficulty ? WORD_LISTS[difficulty] : ALL_WORDS;
  return words[Math.floor(Math.random() * words.length)];
}

export function scrambleWord(word: string): string {
  const letters = word.split('');
  
  for (let attempts = 0; attempts < 10; attempts++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j], letters[i]];
    }
    
    const scrambled = letters.join('');
    if (scrambled !== word) {
      return scrambled;
    }
  }
  
  return letters.join('');
}

export function getDifficulty(wordLength: number): 'easy' | 'medium' | 'hard' | 'expert' {
  if (wordLength <= 5) return 'easy';
  if (wordLength <= 7) return 'medium';
  if (wordLength <= 10) return 'hard';
  return 'expert';
}