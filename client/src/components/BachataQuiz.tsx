import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Music, Trophy, ChevronRight, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
}

interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  feedback: string;
  id?: number;
}

export function BachataQuiz() {
  const { t } = useTranslation();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const { data: questions = [], isLoading, refetch } = useQuery<QuizQuestion[]>({
    queryKey: ["/api/quiz"],
  });

  const submitMutation = useMutation({
    mutationFn: async (answers: Record<number, number>) => {
      const res = await apiRequest("POST", "/api/quiz/submit", { answers });
      return res.json() as Promise<QuizResult>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quiz/results"] });
    },
  });

  const handleSelectAnswer = (questionId: number, answerIndex: number) => {
    if (showExplanation) return;
    setSelectedAnswer(answerIndex);
    setShowExplanation(true);
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setShowResults(true);
      submitMutation.mutate(answers);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setSelectedAnswer(null);
    setShowExplanation(false);
    refetch();
  };

  if (isLoading) {
    return (
      <Card className="glass-panel border-white/5 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Music className="h-8 w-8 animate-pulse text-primary" />
          <span className="text-sm">{t('quiz.loading')}</span>
        </div>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className="glass-panel border-white/5 h-full flex items-center justify-center">
        <div className="text-muted-foreground text-sm">{t('quiz.noQuestions')}</div>
      </Card>
    );
  }

  if (showResults) {
    const result = submitMutation.data;
    return (
      <Card className="glass-panel border-white/5 h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            {t('quiz.results')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center gap-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
            className="w-32 h-32 rounded-full border-4 border-primary/30 flex items-center justify-center bg-primary/5"
          >
            <span className="text-4xl font-bold text-primary" data-testid="text-quiz-score">
              {result?.percentage ?? 0}%
            </span>
          </motion.div>
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold" data-testid="text-quiz-summary">
              {result?.score ?? 0} / {result?.total ?? questions.length} {t('quiz.correctCount')}
            </p>
            <p className="text-sm text-muted-foreground max-w-xs" data-testid="text-quiz-feedback">
              {result?.feedback || t('quiz.greatEffort')}
            </p>
          </div>
          <Button onClick={handleRestart} className="gap-2" data-testid="button-quiz-restart">
            <RotateCcw className="h-4 w-4" />
            {t('quiz.tryAgain')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const question = questions[currentQuestion];
  const isCorrect = selectedAnswer === question.correctAnswer;

  return (
    <Card className="glass-panel border-white/5 h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            {t('quiz.title')}
          </CardTitle>
          <Badge variant="secondary" className="text-xs" data-testid="badge-quiz-progress">
            {currentQuestion + 1} {t('quiz.of')} {questions.length}
          </Badge>
        </div>
        <div className="w-full bg-white/5 rounded-full h-1.5 mt-3">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestion}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-4"
          >
            <Badge variant="outline" className="self-start text-xs">{question.category}</Badge>
            <p className="font-medium text-sm leading-relaxed" data-testid="text-quiz-question">{question.question}</p>
            
            <div className="flex flex-col gap-2">
              {question.options.map((option, index) => {
                let variant: "default" | "outline" | "secondary" | "destructive" = "outline";
                let icon = null;

                if (showExplanation) {
                  if (index === question.correctAnswer) {
                    variant = "default";
                    icon = <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />;
                  } else if (index === selectedAnswer && !isCorrect) {
                    variant = "destructive";
                    icon = <XCircle className="h-4 w-4 flex-shrink-0" />;
                  }
                }

                return (
                  <Button
                    key={index}
                    variant={variant}
                    className="justify-start text-left h-auto py-3 px-4 gap-3 text-sm whitespace-normal"
                    onClick={() => handleSelectAnswer(question.id, index)}
                    disabled={showExplanation}
                    data-testid={`button-quiz-option-${index}`}
                  >
                    {icon}
                    <span className="flex-1">{option}</span>
                  </Button>
                );
              })}
            </div>

            {showExplanation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
              >
                <div className="text-xs text-muted-foreground bg-white/5 rounded-lg p-3 border border-white/5" data-testid="text-quiz-explanation">
                  {question.explanation}
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-auto pt-2">
          {showExplanation && (
            <Button onClick={handleNext} className="w-full gap-2" data-testid="button-quiz-next">
              {currentQuestion < questions.length - 1 ? (
                <>{t('common.next')} <ChevronRight className="h-4 w-4" /></>
              ) : (
                <>{t('quiz.seeResults')} <Trophy className="h-4 w-4" /></>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
