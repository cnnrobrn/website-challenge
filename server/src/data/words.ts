// Comprehensive word list for Word Unscrambler game
// Organized by difficulty/length for better game balance
export const WORD_LISTS = {
  easy: [
    'CAT', 'DOG', 'SUN', 'BAT', 'HAT', 'RUN', 'FUN', 'BIG', 'RED', 'TOP',
    'BOX', 'FOX', 'MAN', 'CAN', 'PAN', 'RAT', 'MAT', 'SAT', 'FAT', 'BAD'
  ],
  
  medium: [
    'HOUSE', 'WATER', 'LIGHT', 'WORLD', 'MUSIC', 'HAPPY', 'PHONE', 'APPLE',
    'BREAD', 'CHAIR', 'TABLE', 'BOOKS', 'PAPER', 'MONEY', 'SMILE', 'DANCE',
    'BEACH', 'OCEAN', 'RIVER', 'CLOUD', 'DREAM', 'MAGIC', 'STORY', 'TIGER'
  ],
  
  hard: [
    'AMAZING', 'COMPUTER', 'ELEPHANT', 'RAINBOW', 'KITCHEN', 'JOURNEY',
    'MYSTERY', 'BALLOON', 'GUITAR', 'SCIENCE', 'DRAGON', 'CASTLE',
    'ROCKET', 'FOREST', 'OCEAN', 'WIZARD', 'PLANET', 'GARDEN',
    'BRIDGE', 'ISLAND', 'TREASURE', 'DIAMOND', 'THUNDER', 'BUTTERFLY',
    'MOUNTAIN', 'CHOCOLATE', 'ADVENTURE', 'MAGICAL', 'SUNSHINE', 'CRYSTAL',
    'FESTIVAL', 'HARMONY', 'VICTORY', 'WARRIOR', 'PHOENIX', 'CHAMPION',
    'FREEDOM', 'COURAGE', 'DESTINY', 'LEGEND'
  ],
  
  expert: [
    'MAGNIFICENT', 'INCREDIBLE', 'EXTRAORDINARY', 'REVOLUTIONARY', 'SOPHISTICATED',
    'ASTRONOMICAL', 'PHILOSOPHICAL', 'TECHNOLOGICAL', 'MATHEMATICAL', 'PSYCHOLOGICAL',
    'ARCHAEOLOGICAL', 'GEOGRAPHICAL', 'PHOTOGRAPHIC', 'BIOGRAPHICAL', 'CHOREOGRAPHY'
  ],

  // Common words for varied gameplay
  common: [
    'ABOUT', 'AFTER', 'AGAIN', 'AGAINST', 'ALMOST', 'ALONE', 'ALONG', 'ALREADY',
    'ALTHOUGH', 'ALWAYS', 'AMONG', 'ANOTHER', 'ANYTHING', 'AROUND', 'BECAUSE',
    'BECOME', 'BEFORE', 'BEING', 'BETWEEN', 'CANNOT', 'CHANGE', 'COMING',
    'COURSE', 'DIFFERENT', 'DURING', 'EARLY', 'EDUCATION', 'ENOUGH', 'EVERY',
    'EXAMPLE', 'FAMILY', 'FATHER', 'FOLLOW', 'FOUND', 'FRIEND', 'GETTING',
    'GOVERNMENT', 'GROUP', 'GROWTH', 'HAPPEN', 'HEALTH', 'HEART', 'HELPED',
    'HISTORY', 'HOUSE', 'HOWEVER', 'HUMAN', 'IMPORTANT', 'INDUSTRY', 'INTEREST',
    'INTERNATIONAL', 'ITSELF', 'KNOWLEDGE', 'LANGUAGE', 'LARGE', 'LEARN',
    'LEVEL', 'LIGHT', 'LITTLE', 'LIVING', 'LOCAL', 'MAKING', 'MARKET',
    'MATTER', 'MEMBER', 'MIGHT', 'MINUTE', 'MONEY', 'MONTH', 'MOTHER',
    'MUSIC', 'NATIONAL', 'NATURE', 'NEVER', 'NIGHT', 'NOTHING', 'NUMBER',
    'OFFICE', 'OFTEN', 'ORDER', 'OTHER', 'OUTSIDE', 'PARTY', 'PEOPLE',
    'PERSON', 'PLACE', 'POINT', 'POWER', 'PRESENT', 'PRICE', 'PRIVATE',
    'PROBLEM', 'PROGRAM', 'PROJECT', 'PUBLIC', 'QUALITY', 'QUESTION',
    'REALLY', 'REASON', 'REMEMBER', 'REPORT', 'RESEARCH', 'RESULT', 'RIGHT',
    'SCHOOL', 'SECOND', 'SECTION', 'SEEMED', 'SERIOUS', 'SERVICE', 'SHALL',
    'SHOULD', 'SIMPLY', 'SINCE', 'SOCIAL', 'SOMETHING', 'SPECIAL', 'SPIRIT',
    'STREET', 'STRONG', 'STUDENT', 'STUDY', 'SUPPORT', 'SYSTEM', 'TAKEN',
    'THOUGH', 'THREE', 'THROUGH', 'TODAY', 'TOGETHER', 'TOMORROW', 'TOTAL',
    'TRAINING', 'TRAVEL', 'TREATMENT', 'TURNED', 'UNDER', 'UNDERSTANDING',
    'UNITED', 'UNIVERSITY', 'UNTIL', 'USUALLY', 'VALUE', 'VOICE', 'WATER',
    'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE', 'WOMAN', 'WOMEN',
    'WORDS', 'WORKED', 'WORKING', 'WORLD', 'WOULD', 'WRITE', 'WRITTEN',
    'YEARS', 'YOUNG'
  ]
};

// Combined list for random selection
export const ALL_WORDS = [
  ...WORD_LISTS.easy,
  ...WORD_LISTS.medium,
  ...WORD_LISTS.hard,
  ...WORD_LISTS.expert,
  ...WORD_LISTS.common
];

// Function to get words by difficulty
export function getWordsByDifficulty(difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'common' | 'all' = 'all'): string[] {
  if (difficulty === 'all') {
    return ALL_WORDS;
  }
  return WORD_LISTS[difficulty];
}

// Function to get random word by difficulty
export function getRandomWord(difficulty: 'easy' | 'medium' | 'hard' | 'expert' | 'common' | 'all' = 'all'): string {
  const words = getWordsByDifficulty(difficulty);
  return words[Math.floor(Math.random() * words.length)];
}