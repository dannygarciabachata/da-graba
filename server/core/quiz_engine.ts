import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: "history" | "instruments" | "artists" | "rhythm" | "culture";
}

export interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  feedback: string;
}

const STATIC_QUIZ_BANK: QuizQuestion[] = [
  {
    id: 1,
    question: "Which instrument is essential in traditional Bachata music?",
    options: ["Electric guitar", "Requinto guitar", "Saxophone", "Accordion"],
    correctAnswer: 1,
    explanation: "The requinto guitar plays the melodic lead in traditional Bachata, creating the signature sound of the genre.",
    category: "instruments",
  },
  {
    id: 2,
    question: "In what country did Bachata originate?",
    options: ["Cuba", "Puerto Rico", "Dominican Republic", "Colombia"],
    correctAnswer: 2,
    explanation: "Bachata originated in the Dominican Republic in the early 1960s, evolving from bolero and other Latin American genres.",
    category: "history",
  },
  {
    id: 3,
    question: "Which percussion instrument creates the distinctive 'tsss-tsss' rhythm in Bachata?",
    options: ["Maracas", "Guira", "Tambourine", "Claves"],
    correctAnswer: 1,
    explanation: "The guira (a metal scraper) creates the characteristic 'tsss-tsss' rhythm pattern in Bachata music.",
    category: "instruments",
  },
  {
    id: 4,
    question: "Who is known as 'The King of Bachata'?",
    options: ["Juan Luis Guerra", "Romeo Santos", "Prince Royce", "Frank Reyes"],
    correctAnswer: 1,
    explanation: "Romeo Santos is widely known as 'The King of Bachata' for his massive influence in modernizing and popularizing the genre worldwide.",
    category: "artists",
  },
  {
    id: 5,
    question: "What is the typical BPM range for traditional Bachata?",
    options: ["60-70 BPM", "70-85 BPM", "100-120 BPM", "130-150 BPM"],
    correctAnswer: 1,
    explanation: "Traditional Bachata typically ranges from 70-85 BPM, giving it a slow, sensual feel perfect for close dancing.",
    category: "rhythm",
  },
  {
    id: 6,
    question: "What group brought Bachata to mainstream American audiences in the early 2000s?",
    options: ["Grupo Niche", "Aventura", "Los Hermanos Rosario", "Monchy y Alexandra"],
    correctAnswer: 1,
    explanation: "Aventura, led by Romeo Santos, brought Bachata to mainstream American audiences with hits like 'Obsesion' in the early 2000s.",
    category: "artists",
  },
  {
    id: 7,
    question: "Which key signature is most commonly used in emotional Bachata songs?",
    options: ["C Major", "A Minor", "G Major", "E Major"],
    correctAnswer: 1,
    explanation: "Minor keys, especially A minor and D minor, are commonly used in emotional Bachata songs to convey longing and passion.",
    category: "rhythm",
  },
  {
    id: 8,
    question: "What dance step is the foundation of Bachata dancing?",
    options: ["The box step", "The basic side-to-side with hip pop", "The cross-body lead", "The spin"],
    correctAnswer: 1,
    explanation: "The basic Bachata dance step is a side-to-side movement with a distinctive hip pop on the 4th beat.",
    category: "culture",
  },
  {
    id: 9,
    question: "Who is known as 'El Principe de la Bachata'?",
    options: ["Anthony Santos", "Frank Reyes", "Luis Vargas", "Raulin Rodriguez"],
    correctAnswer: 1,
    explanation: "Frank Reyes is known as 'El Principe de la Bachata' (The Prince of Bachata) for his emotionally powerful vocals and heartbreak songs.",
    category: "artists",
  },
  {
    id: 10,
    question: "What role does the bongo play in Bachata?",
    options: ["Lead melody", "Bass rhythm", "Rhythmic accompaniment and fills", "Harmonic support"],
    correctAnswer: 2,
    explanation: "The bongo provides rhythmic accompaniment, fills, and accents that complement the guira pattern in Bachata.",
    category: "instruments",
  },
];

export function getRandomQuiz(count: number = 5): QuizQuestion[] {
  const shuffled = [...STATIC_QUIZ_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getQuizByCategory(category: QuizQuestion["category"]): QuizQuestion[] {
  return STATIC_QUIZ_BANK.filter((q) => q.category === category);
}

export function evaluateQuiz(answers: Record<number, number>): QuizResult {
  let score = 0;
  const total = Object.keys(answers).length;

  for (const [questionId, selectedAnswer] of Object.entries(answers)) {
    const question = STATIC_QUIZ_BANK.find((q) => q.id === Number(questionId));
    if (question && question.correctAnswer === selectedAnswer) {
      score++;
    }
  }

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  let feedback: string;
  if (percentage === 100) {
    feedback = "You are a true Bachata master! Danny Garcia would be proud.";
  } else if (percentage >= 80) {
    feedback = "Excellent knowledge! You clearly know your Bachata.";
  } else if (percentage >= 60) {
    feedback = "Good job! Keep exploring the world of Bachata.";
  } else if (percentage >= 40) {
    feedback = "Not bad! There's always more to learn about this beautiful genre.";
  } else {
    feedback = "Time to listen to more Bachata! Start with some Romeo Santos and Frank Reyes.";
  }

  return { score, total, percentage, feedback };
}

export async function generateAIQuiz(topic: string, count: number = 5): Promise<QuizQuestion[]> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    messages: [
      {
        role: "system",
        content: `You are a Bachata music expert. Generate ${count} multiple-choice quiz questions about "${topic}" related to Bachata music. 
Return a JSON array of objects with: id (number), question (string), options (array of 4 strings), correctAnswer (index 0-3), explanation (string), category (one of: history, instruments, artists, rhythm, culture).`,
      },
      { role: "user", content: `Generate quiz questions about: ${topic}` },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2048,
  });

  const content = completion.choices[0].message.content || '{"questions":[]}';
  const parsed = JSON.parse(content);
  return parsed.questions || parsed;
}
