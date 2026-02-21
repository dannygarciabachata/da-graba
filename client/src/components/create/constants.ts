export const GENRE_CATEGORIES = [
  {
    category: "DA GRABA",
    icon: "🎸",
    genres: [
      { value: "Bachata", label: "DA GRABACHATA", likes: "97K", accent: true },
      { value: "Bolero", label: "DA GRABOLERO", likes: "42K", accent: true },
    ],
  },
  {
    category: "Latino & Caribeño",
    icon: "🌴",
    genres: [
      { value: "Salsa", label: "Salsa", likes: "72K" },
      { value: "Merengue", label: "Merengue", likes: "58K" },
      { value: "Cumbia", label: "Cumbia", likes: "54K" },
      { value: "Vallenato", label: "Vallenato", likes: "36K" },
      { value: "Son", label: "Son", likes: "22K" },
      { value: "Mambo", label: "Mambo", likes: "28K" },
      { value: "Cha-Cha-Chá", label: "Cha-Cha-Chá", likes: "24K" },
      { value: "Guaracha", label: "Guaracha", likes: "19K" },
      { value: "Plena", label: "Plena", likes: "15K" },
      { value: "Bomba", label: "Bomba", likes: "14K" },
      { value: "Punta", label: "Punta", likes: "11K" },
      { value: "Champeta", label: "Champeta", likes: "13K" },
      { value: "Tropical", label: "Tropical", likes: "26K" },
    ],
  },
  {
    category: "Urbano",
    icon: "🔥",
    genres: [
      { value: "Reggaeton", label: "Reggaeton", likes: "65K" },
      { value: "Dembow", label: "Dembow", likes: "31K" },
      { value: "Latin Pop", label: "Latin Pop", likes: "34K" },
      { value: "Hip Hop", label: "Hip Hop", likes: "45K" },
      { value: "R&B", label: "R&B", likes: "48K" },
    ],
  },
  {
    category: "Electrónica",
    icon: "⚡",
    genres: [
      { value: "EDM", label: "EDM", likes: "31K" },
      { value: "House", label: "House", likes: "18K" },
      { value: "Synthwave", label: "Synthwave", likes: "27K" },
      { value: "Drum & Bass", label: "Drum & Bass", likes: "14K" },
    ],
  },
  {
    category: "Pop & Global",
    icon: "🌍",
    genres: [
      { value: "Pop", label: "Pop", likes: "32K" },
      { value: "K-pop", label: "K-pop", likes: "38K" },
      { value: "Afrobeat", label: "Afrobeat", likes: "41K" },
      { value: "Indie", label: "Indie", likes: "21K" },
    ],
  },
  {
    category: "Clásicos",
    icon: "🎷",
    genres: [
      { value: "Jazz", label: "Jazz", likes: "13K" },
      { value: "Blues", label: "Blues", likes: "12K" },
      { value: "Soul", label: "Soul", likes: "23K" },
      { value: "Funk", label: "Funk", likes: "17K" },
      { value: "Rock", label: "Rock", likes: "25K" },
      { value: "Country", label: "Country", likes: "15K" },
      { value: "Classical", label: "Classical", likes: "9K" },
    ],
  },
];

export const GENRE_CARDS = GENRE_CATEGORIES.flatMap((cat) => cat.genres);

export const PROMPT_SUGGESTIONS = [
  "R&B with female vocals about Los Angeles",
  "Upbeat pop anthem about summer freedom",
  "Romantic bachata under Caribbean moonlight",
  "Chill lo-fi hip hop beat for studying",
  "Energetic EDM drop with euphoric synths",
  "Soulful jazz ballad with saxophone",
  "Dark trap beat with heavy 808s",
  "Acoustic folk song about road trips",
];

export const BACHATA_SUGGESTIONS = [
  "Bachata romántica bajo la luna del Caribe",
  "Bachata moderna con fusión de R&B",
  "Bachata sensual con guitarra suave",
  "Bachata urbana con beats de trap",
  "Bachata tradicional dominicana con güira",
  "Bachata rosa sobre primer amor",
];

export const BOLERO_SUGGESTIONS = [
  "Bolero romántico de amor eterno",
  "Bolero con guitarra clásica de nylon",
  "Bolero ranchero con mariachi",
  "Bolero moderno con arreglos de cuerdas",
  "Bolero son con sabor cubano",
  "Balada bolero de desamor",
];

export const TTS_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
];

export type DnaFlow = "bachata" | "bolero" | null;
export type CreationMode = "song" | "sound" | "speak";

export const GENRE_SLUG_TO_VALUE: Record<string, string> = {
  bachata: "Bachata",
  bolero: "Bolero",
  merengue: "Merengue",
  salsa: "Salsa",
  cumbia: "Cumbia",
  vallenato: "Vallenato",
  reggaeton: "Reggaeton",
  latin_pop: "Latin Pop",
  son: "Son",
  mambo: "Mambo",
  cha_cha_cha: "Cha-Cha-Chá",
  guaracha: "Guaracha",
  dembow: "Dembow",
  tropical: "Tropical",
};

export const GENRE_VALUE_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(GENRE_SLUG_TO_VALUE).map(([k, v]) => [v, k])
);

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
