/**
 * Escucha y responde — ¡Habla sin miedo!
 * Español + Հայերեն | 7.º curso | A1–B1
 * Интерактивный тренажер разговорных вопросов и ответов для школьников в Испании
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Volume2,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  RotateCcw,
  Timer,
  BookOpen,
  Search,
  ArrowLeftRight,
  Check,
  Type
} from 'lucide-react';
import {
  ALL_QUESTIONS,
  LEVEL_1_ITEMS,
  LEVEL_2_ITEMS,
  BONUS_PHRASES,
  QUICK_CHALLENGES,
  DialogItem,
  QuickChallengeItem
} from './data';

type ViewMode = 'catalog' | 'flashcard' | 'challenge' | 'bonus';
type Direction = 'es-to-arm' | 'arm-to-es';
type SpeedMode = 0.75 | 1.0;
type FontSizeMode = 'normal' | 'large' | 'xl';

export default function App() {
  // Navigation & Modes
  const [viewMode, setViewMode] = useState<ViewMode>('catalog');
  const [selectedLevel, setSelectedLevel] = useState<'all' | 'A1-A2' | 'A2-B1'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [direction, setDirection] = useState<Direction>('es-to-arm');
  const [speechSpeed, setSpeechSpeed] = useState<SpeedMode>(1.0);
  const [fontSizeMode, setFontSizeMode] = useState<FontSizeMode>('large');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string | null>(null);

  // Catalog reveal states (map of questionId -> boolean)
  const [revealedIds, setRevealedIds] = useState<Record<number, boolean>>({});

  // Flashcard focus mode
  const [flashcardIndex, setFlashcardIndex] = useState<number>(0);
  const [isFlashcardRevealed, setIsFlashcardRevealed] = useState<boolean>(false);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);

  // 5-Second Challenge Game state
  const [challengeIndex, setChallengeIndex] = useState<number>(0);
  const [challengeTimeLeft, setChallengeTimeLeft] = useState<number>(5);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isChallengeRevealed, setIsChallengeRevealed] = useState<boolean>(false);
  const [challengeScores, setChallengeScores] = useState<Record<number, 'known' | 'hard'>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic Typography Classes based on font size setting
  const cardQuestionClass = useMemo(() => {
    switch (fontSizeMode) {
      case 'xl':
        return 'text-xl sm:text-2xl font-bold leading-snug';
      case 'large':
        return 'text-lg sm:text-xl font-bold leading-snug';
      default:
        return 'text-base sm:text-lg font-semibold leading-snug';
    }
  }, [fontSizeMode]);

  const cardTranslationClass = useMemo(() => {
    switch (fontSizeMode) {
      case 'xl':
        return 'text-lg sm:text-xl font-medium';
      case 'large':
        return 'text-base sm:text-lg font-medium';
      default:
        return 'text-sm sm:text-base font-medium';
    }
  }, [fontSizeMode]);

  const cardAnswerEsClass = useMemo(() => {
    switch (fontSizeMode) {
      case 'xl':
        return 'text-lg sm:text-xl font-bold text-slate-900';
      case 'large':
        return 'text-base sm:text-lg font-bold text-slate-900';
      default:
        return 'text-base font-semibold text-slate-900';
    }
  }, [fontSizeMode]);

  const cardAnswerArmClass = useMemo(() => {
    switch (fontSizeMode) {
      case 'xl':
        return 'text-base sm:text-lg text-slate-700 mt-1';
      case 'large':
        return 'text-sm sm:text-base text-slate-700 mt-1';
      default:
        return 'text-sm text-slate-600 mt-0.5';
    }
  }, [fontSizeMode]);

  const flashcardQuestionClass = useMemo(() => {
    switch (fontSizeMode) {
      case 'xl':
        return 'text-3xl sm:text-4xl font-extrabold text-slate-900 leading-snug mb-4';
      case 'large':
        return 'text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug mb-4';
      default:
        return 'text-xl sm:text-2xl font-bold text-slate-900 leading-snug mb-3';
    }
  }, [fontSizeMode]);

  const flashcardAnswerClass = useMemo(() => {
    switch (fontSizeMode) {
      case 'xl':
        return 'text-xl sm:text-2xl font-bold text-slate-900';
      case 'large':
        return 'text-lg sm:text-xl font-bold text-slate-900';
      default:
        return 'text-base sm:text-lg font-semibold text-slate-900';
    }
  }, [fontSizeMode]);

  // Speech synthesis
  const speakText = (text: string, lang = 'es-ES') => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = speechSpeed;

    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(
      (v) => v.lang.toLowerCase().startsWith('es') || v.lang.includes('ES')
    );
    if (targetVoice) {
      utterance.voice = targetVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setActiveSpeechText(text);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setActiveSpeechText(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setActiveSpeechText(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setActiveSpeechText(null);
  };

  // Filtered dataset
  const filteredQuestions = useMemo(() => {
    return ALL_QUESTIONS.filter((item) => {
      const matchLevel = selectedLevel === 'all' || item.level === selectedLevel;
      const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchSearch =
        !query ||
        item.questionEs.toLowerCase().includes(query) ||
        item.questionArm.toLowerCase().includes(query) ||
        item.answerEs.toLowerCase().includes(query) ||
        item.answerArm.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.categoryArm.toLowerCase().includes(query);

      return matchLevel && matchCategory && matchSearch;
    });
  }, [selectedLevel, selectedCategory, searchQuery]);

  // Categories list based on current level selection
  const availableCategories = useMemo(() => {
    const source =
      selectedLevel === 'A1-A2'
        ? LEVEL_1_ITEMS
        : selectedLevel === 'A2-B1'
        ? LEVEL_2_ITEMS
        : ALL_QUESTIONS;
    const cats = new Map<string, string>();
    source.forEach((item) => {
      if (!cats.has(item.category)) {
        cats.set(item.category, item.categoryArm);
      }
    });
    return Array.from(cats.entries()).map(([cat, arm]) => ({
      category: cat,
      categoryArm: arm,
    }));
  }, [selectedLevel]);

  // Flashcards working array (optionally shuffled)
  const flashcardList = useMemo(() => {
    if (!isShuffled) return filteredQuestions;
    if (shuffledOrder.length !== filteredQuestions.length) {
      const indices = filteredQuestions.map((_, i) => i);
      return indices.sort(() => Math.random() - 0.5).map((i) => filteredQuestions[i]);
    }
    return shuffledOrder.map((i) => filteredQuestions[i] || filteredQuestions[0]);
  }, [filteredQuestions, isShuffled, shuffledOrder]);

  // Reset flashcard state when changing list
  useEffect(() => {
    setFlashcardIndex(0);
    setIsFlashcardRevealed(false);
  }, [selectedLevel, selectedCategory, isShuffled]);

  // Toggle reveal for a card in catalog mode
  const toggleCardReveal = (id: number) => {
    setRevealedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const revealAllInView = () => {
    const next: Record<number, boolean> = {};
    filteredQuestions.forEach((q) => {
      next[q.id] = true;
    });
    setRevealedIds(next);
  };

  const hideAllInView = () => {
    setRevealedIds({});
  };

  // 5-Second Timer Logic
  useEffect(() => {
    if (viewMode !== 'challenge') {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsTimerRunning(false);
      return;
    }

    if (isTimerRunning && challengeTimeLeft > 0) {
      timerRef.current = setInterval(() => {
        setChallengeTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsTimerRunning(false);
            setIsChallengeRevealed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [viewMode, isTimerRunning, challengeTimeLeft]);

  const startChallengeRound = (indexToStart: number) => {
    setChallengeIndex(indexToStart);
    setChallengeTimeLeft(5);
    setIsChallengeRevealed(false);
    setIsTimerRunning(true);
    const item = QUICK_CHALLENGES[indexToStart];
    if (item) {
      speakText(item.questionEs);
    }
  };

  const nextChallengeItem = () => {
    if (challengeIndex < QUICK_CHALLENGES.length - 1) {
      startChallengeRound(challengeIndex + 1);
    } else {
      setIsTimerRunning(false);
    }
  };

  const currentChallenge = QUICK_CHALLENGES[challengeIndex];
  const currentFlashcard = flashcardList[flashcardIndex];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col selection:bg-amber-100 selection:text-amber-900">
      {/* 3-Zone Clean Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xl border border-amber-500/20 shadow-xs">
              🎧
            </div>
            <div className="leading-tight">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap block">
                Escucha y responde
              </span>
              <span className="text-xs sm:text-sm text-slate-500 hidden sm:inline">
                Español + Հայերեն · 7.º curso
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Views */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => {
                setViewMode('catalog');
                stopSpeaking();
              }}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                viewMode === 'catalog'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              130 Հարց ու պատասխան
            </button>
            <button
              onClick={() => {
                setViewMode('flashcard');
                stopSpeaking();
              }}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                viewMode === 'flashcard'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Քարտեր (Focus)
            </button>
            <button
              onClick={() => {
                setViewMode('challenge');
                stopSpeaking();
                startChallengeRound(0);
              }}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
                viewMode === 'challenge'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Timer className="w-4 h-4" />
              Խաղ՝ 5 վայրկյան
            </button>
            <button
              onClick={() => {
                setViewMode('bonus');
                stopSpeaking();
              }}
              className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-all whitespace-nowrap ${
                viewMode === 'bonus'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              15 Օգնող արտահայտություն
            </button>
          </nav>

          {/* Zone 3: Quick Action, Font Size & Speech Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Font Size Toggle Button */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setFontSizeMode('normal')}
                title="Стандартный шрифт / Ստանդարտ տառաչափ"
                className={`px-2 py-1 text-xs font-semibold rounded-md transition-colors ${
                  fontSizeMode === 'normal'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                A
              </button>
              <button
                onClick={() => setFontSizeMode('large')}
                title="Крупный шрифт (рекомендуется) / Խոշոր տառաչափ"
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                  fontSizeMode === 'large'
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                A+
              </button>
              <button
                onClick={() => setFontSizeMode('xl')}
                title="Очень крупный шрифт / Շատ խոշոր տառաչափ"
                className={`px-2.5 py-1 text-xs font-black rounded-md transition-colors ${
                  fontSizeMode === 'xl'
                    ? 'bg-white text-amber-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                A++
              </button>
            </div>

            {/* Audio speed */}
            <button
              onClick={() => setSpeechSpeed(speechSpeed === 1.0 ? 0.75 : 1.0)}
              title="Փոխել խոսքի արագությունը (նորմալ / դանդաղ)"
              className="px-2.5 py-1.5 text-xs sm:text-sm font-medium border border-slate-200 rounded-md bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 transition-colors"
            >
              <Volume2 className="w-4 h-4 text-amber-600" />
              <span>{speechSpeed === 0.75 ? '0.75x' : '1.0x'}</span>
            </button>

            {/* Language direction */}
            <button
              onClick={() =>
                setDirection(direction === 'es-to-arm' ? 'arm-to-es' : 'es-to-arm')
              }
              title="Փոխել ուղղությունը"
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{direction === 'es-to-arm' ? 'ES ➔ HY' : 'HY ➔ ES'}</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="md:hidden flex overflow-x-auto border-t border-slate-100 px-3 py-2 gap-1.5 bg-slate-50">
          <button
            onClick={() => setViewMode('catalog')}
            className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
              viewMode === 'catalog' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Ցուցակ (130)
          </button>
          <button
            onClick={() => setViewMode('flashcard')}
            className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
              viewMode === 'flashcard' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            Քարտեր
          </button>
          <button
            onClick={() => {
              setViewMode('challenge');
              startChallengeRound(0);
            }}
            className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap flex items-center gap-1 ${
              viewMode === 'challenge' ? 'bg-amber-600 text-white' : 'text-slate-600'
            }`}
          >
            <Timer className="w-3.5 h-3.5" /> 5 վրկ
          </button>
          <button
            onClick={() => setViewMode('bonus')}
            className={`px-3 py-1 text-xs font-medium rounded whitespace-nowrap ${
              viewMode === 'bonus' ? 'bg-slate-900 text-white' : 'text-slate-600'
            }`}
          >
            15 Ֆրազ
          </button>
          <button
            onClick={() =>
              setDirection(direction === 'es-to-arm' ? 'arm-to-es' : 'es-to-arm')
            }
            className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded text-slate-700 ml-auto whitespace-nowrap"
          >
            {direction === 'es-to-arm' ? 'ES ➔ HY' : 'HY ➔ ES'}
          </button>
        </div>
      </header>

      {/* Hero Banner with pedagogical context */}
      <section className="bg-gradient-to-b from-white to-slate-50 border-b border-slate-200 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-amber-700 mb-2">
              <span>Իսպանիայի 7-րդ դասարանի դպրոցական իրավիճակներ</span>
              <span>·</span>
              <span>A1–B1 մակարդակ</span>
              <span>·</span>
              <span>60 + 70 հարց ու պատասխան</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 text-balance mb-2">
              Лови на слух — ¡Habla sin miedo!
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed text-pretty">
              Կտտացրու իսպաներեն հարցի վրա՝ հայերեն թարգմանությունն ու պատրաստի պատասխանը բացելու համար։
              Լսիր արտասանությունը ձայնով, սովորիր արագ արձագանքել առանց վախի։
            </p>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* VIEW 1: CATALOG LIST VIEW */}
        {viewMode === 'catalog' && (
          <div>
            {/* Filter and Search Bar */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Level Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => {
                      setSelectedLevel('all');
                      setSelectedCategory('all');
                    }}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
                      selectedLevel === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Բոլորը (130)
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLevel('A1-A2');
                      setSelectedCategory('all');
                    }}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
                      selectedLevel === 'A1-A2'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Մաս 1 · A1–A2 (60)
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLevel('A2-B1');
                      setSelectedCategory('all');
                    }}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
                      selectedLevel === 'A2-B1'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Մաս 2 · A2–B1 (70)
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Որոնել բառ իսպաներեն կամ հայերեն..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:border-amber-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-colors"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Bulk controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={revealAllInView}
                    className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5"
                    title="Բացել բոլոր թարգմանություններն ու պատասխանները"
                  >
                    <Eye className="w-4 h-4 text-slate-600" />
                    Բացել բոլորը
                  </button>
                  <button
                    onClick={hideAllInView}
                    className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-1.5"
                    title="Փակել բոլոր թարգմանությունները"
                  >
                    <EyeOff className="w-4 h-4 text-slate-600" />
                    Փակել
                  </button>
                </div>
              </div>

              {/* Category Pills/Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-100 pb-1 scrollbar-thin">
                <span className="text-xs sm:text-sm text-slate-400 font-medium shrink-0 mr-1">Բաժիններ՝</span>
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Բոլոր թեմաները ({filteredQuestions.length})
                </button>
                {availableCategories.map((cat) => {
                  const count = (
                    selectedLevel === 'all'
                      ? ALL_QUESTIONS
                      : selectedLevel === 'A1-A2'
                      ? LEVEL_1_ITEMS
                      : LEVEL_2_ITEMS
                  ).filter((q) => q.category === cat.category).length;

                  return (
                    <button
                      key={cat.category}
                      onClick={() => setSelectedCategory(cat.category)}
                      className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap transition-colors ${
                        selectedCategory === cat.category
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat.category} · {cat.categoryArm} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Questions Grid */}
            {filteredQuestions.length === 0 ? (
              <div className="text-center py-16 bg-white border border-slate-200 rounded-xl">
                <p className="text-slate-500 text-base">Որոնմամբ ոչինչ չգտնվեց</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('all');
                    setSelectedLevel('all');
                  }}
                  className="mt-3 px-4 py-2 text-sm font-semibold text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors"
                >
                  Մաքրել ֆիլտրերը
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {filteredQuestions.map((item) => {
                  const isRevealed = !!revealedIds[item.id];
                  const primaryQuestion = direction === 'es-to-arm' ? item.questionEs : item.questionArm;
                  const secondaryQuestion = direction === 'es-to-arm' ? item.questionArm : item.questionEs;

                  return (
                    <div
                      key={item.id}
                      className={`group border rounded-2xl p-5 transition-all duration-150 bg-white ${
                        isRevealed
                          ? 'border-amber-400 shadow-sm ring-1 ring-amber-200'
                          : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
                      }`}
                    >
                      {/* Top Header Row of the Card */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 font-medium">
                          <span className="font-mono tabular-nums text-slate-400 font-semibold">#{item.id}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-400">{item.level}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Audio button for Spanish Question */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              speakText(item.questionEs);
                            }}
                            title="Լսել իսպաներեն հարցը"
                            className={`p-2 rounded-lg transition-colors ${
                              activeSpeechText === item.questionEs
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>

                          {/* Reveal toggle button */}
                          <button
                            type="button"
                            onClick={() => toggleCardReveal(item.id)}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title={isRevealed ? 'Թաքցնել թարգմանությունը' : 'Բացել թարգմանությունը'}
                          >
                            {isRevealed ? (
                              <EyeOff className="w-4 h-4 text-slate-500" />
                            ) : (
                              <Eye className="w-4 h-4 text-amber-600" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Clickable Question trigger (as requested: "при клике на исп пусть откроется перевод на арм и ответы тоже") */}
                      <button
                        type="button"
                        onClick={() => toggleCardReveal(item.id)}
                        className="w-full text-left cursor-pointer group-hover:text-amber-950"
                      >
                        <div className={`${cardQuestionClass} text-slate-900`}>
                          {primaryQuestion}
                        </div>
                        {!isRevealed && (
                          <div className="mt-2.5 text-sm text-amber-700 font-semibold flex items-center gap-1.5">
                            <span>Կտտացրու՝ բացելու հայերեն թարգմանությունն ու պատասխանը</span>
                            <span>→</span>
                          </div>
                        )}
                      </button>

                      {/* Revealed Section: Translation + Answer */}
                      {isRevealed && (
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                          {/* Translation */}
                          <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3.5">
                            <span className="text-xs font-bold text-amber-900 uppercase tracking-wide block mb-1">
                              {direction === 'es-to-arm' ? 'Հայերեն թարգմանություն' : 'Traducción al español'}
                            </span>
                            <p className={`${cardTranslationClass} text-slate-900`}>
                              {secondaryQuestion}
                            </p>
                          </div>

                          {/* Suggested Model Answer */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                                Պատրաստի պատասխան / Respuesta sugerida
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakText(item.answerEs);
                                }}
                                title="Լսել իսպաներեն պատասխանը"
                                className="text-sm text-amber-700 hover:text-amber-800 flex items-center gap-1 font-semibold"
                              >
                                <Volume2 className="w-4 h-4" />
                                <span>Լսել</span>
                              </button>
                            </div>
                            <p className={cardAnswerEsClass}>
                              {item.answerEs}
                            </p>
                            <p className={cardAnswerArmClass}>
                              {item.answerArm}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FLASHCARD / FOCUS INTERACTIVE MODE */}
        {viewMode === 'flashcard' && currentFlashcard && (
          <div className="max-w-2xl mx-auto py-4">
            {/* Top Toolbar for Flashcard */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                  Քարտ {flashcardIndex + 1} / {flashcardList.length}
                </span>
                <span className="text-sm text-slate-400">·</span>
                <span className="text-sm text-slate-700 font-semibold">
                  {currentFlashcard.category}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsShuffled(!isShuffled)}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-md border transition-colors flex items-center gap-1.5 ${
                    isShuffled
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-700'
                  }`}
                  title="Խառնել հարցերի հերթականությունը"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>{isShuffled ? 'Խառնված է' : 'Խառնել'}</span>
                </button>

                <button
                  onClick={() => {
                    setFlashcardIndex(0);
                    setIsFlashcardRevealed(false);
                  }}
                  className="p-2 text-slate-500 hover:text-slate-800 rounded-md border border-slate-200 bg-white"
                  title="Վերադառնալ սկիզբ"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Flashcard Body Card */}
            <div
              onClick={() => setIsFlashcardRevealed(!isFlashcardRevealed)}
              className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 min-h-[360px] shadow-xs cursor-pointer flex flex-col justify-between transition-all hover:border-amber-300"
            >
              <div>
                <div className="flex items-center justify-between text-xs sm:text-sm text-slate-400 font-mono mb-4">
                  <span>ՀԱՐՑ #{currentFlashcard.id}</span>
                  <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-sans font-medium">
                    {currentFlashcard.level}
                  </span>
                </div>

                <div className={flashcardQuestionClass}>
                  {direction === 'es-to-arm'
                    ? currentFlashcard.questionEs
                    : currentFlashcard.questionArm}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      speakText(currentFlashcard.questionEs);
                    }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl text-sm font-bold transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Լսել իսպաներեն</span>
                  </button>
                </div>
              </div>

              {/* Bottom revealed area */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                {isFlashcardRevealed ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-4">
                      <div className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-1">
                        Հայերեն թարգմանություն
                      </div>
                      <div className={`${cardTranslationClass} text-slate-900`}>
                        {direction === 'es-to-arm'
                          ? currentFlashcard.questionArm
                          : currentFlashcard.questionEs}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                          Պատասխան / Respuesta
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakText(currentFlashcard.answerEs);
                          }}
                          className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                        >
                          <Volume2 className="w-4 h-4" /> Լսել պատասխանը
                        </button>
                      </div>
                      <div className={flashcardAnswerClass}>
                        {currentFlashcard.answerEs}
                      </div>
                      <div className={`${cardAnswerArmClass} text-slate-600`}>
                        {currentFlashcard.answerArm}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm font-semibold text-slate-400">
                    Կտտացրու քարտին՝ պատասխանն ու թարգմանությունը տեսնելու համար
                  </div>
                )}
              </div>
            </div>

            {/* Stepper Buttons */}
            <div className="flex items-center justify-between gap-4 mt-6">
              <button
                disabled={flashcardIndex === 0}
                onClick={() => {
                  setFlashcardIndex((prev) => Math.max(0, prev - 1));
                  setIsFlashcardRevealed(false);
                }}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-sm font-bold text-slate-800 flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <ChevronLeft className="w-4 h-4" />
                Նախորդը
              </button>

              <button
                onClick={() => setIsFlashcardRevealed(!isFlashcardRevealed)}
                className="flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                {isFlashcardRevealed ? 'Թաքցնել' : 'Բացել'}
              </button>

              <button
                disabled={flashcardIndex >= flashcardList.length - 1}
                onClick={() => {
                  setFlashcardIndex((prev) => Math.min(flashcardList.length - 1, prev + 1));
                  setIsFlashcardRevealed(false);
                }}
                className="flex-1 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-sm font-bold text-slate-800 flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                Հաջորդը
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* VIEW 3: 5-SECOND CHALLENGE GAME */}
        {viewMode === 'challenge' && currentChallenge && (
          <div className="max-w-2xl mx-auto py-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs sm:text-sm font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                    <Timer className="w-4 h-4" /> 5 վայրկյան
                  </span>
                  <span className="text-sm text-slate-500 font-semibold">
                    Հարց {challengeIndex + 1} / {QUICK_CHALLENGES.length}
                  </span>
                </div>

                {/* Score count */}
                <div className="text-sm text-slate-600 font-bold">
                  Արդյունք՝ {Object.values(challengeScores).filter((s) => s === 'known').length} /{' '}
                  {challengeIndex}
                </div>
              </div>

              {/* Timer Progress Bar */}
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-6">
                <div
                  className={`h-full transition-all duration-1000 ${
                    challengeTimeLeft > 2 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${(challengeTimeLeft / 5) * 100}%` }}
                />
              </div>

              {/* Countdown Number */}
              <div className="text-center mb-6">
                <span
                  className={`inline-block font-mono text-5xl sm:text-6xl font-black ${
                    challengeTimeLeft <= 2 ? 'text-red-600 animate-pulse' : 'text-slate-900'
                  }`}
                >
                  {challengeTimeLeft}s
                </span>
                <p className="text-sm text-slate-600 mt-2 font-medium">
                  {isTimerRunning
                    ? 'Լսիր և արագ պատասխանիր իսպաներեն բարձրաձայն։'
                    : 'Ժամանակը լրացավ։ Ստուգիր քո պատասխանը։'}
                </p>
              </div>

              {/* The Question */}
              <div className="text-center mb-8">
                <h2 className={`${flashcardQuestionClass} text-slate-900 mb-3`}>
                  {currentChallenge.questionEs}
                </h2>
                <button
                  onClick={() => speakText(currentChallenge.questionEs)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl text-sm font-bold transition-colors"
                >
                  <Volume2 className="w-4 h-4 text-amber-600" />
                  <span>Կրկին լսել հարցը</span>
                </button>
              </div>

              {/* Revealed content */}
              {isChallengeRevealed ? (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <span className="text-xs font-bold text-amber-900 uppercase block mb-1">
                      Հայերեն թարգմանություն
                    </span>
                    <p className={`${cardTranslationClass} font-semibold text-slate-900`}>
                      {currentChallenge.questionArm}
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-600 uppercase">
                        Հնարավոր պատասխան
                      </span>
                      <button
                        onClick={() => speakText(currentChallenge.suggestedAnswerEs)}
                        className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                      >
                        <Volume2 className="w-4 h-4" /> Լսել
                      </button>
                    </div>
                    <p className={cardAnswerEsClass}>
                      {currentChallenge.suggestedAnswerEs}
                    </p>
                    <p className={cardAnswerArmClass}>
                      {currentChallenge.suggestedAnswerArm}
                    </p>
                  </div>

                  {/* Feedback self-evaluation */}
                  <div className="pt-3 flex items-center justify-center gap-3">
                    <button
                      onClick={() => {
                        setChallengeScores((prev) => ({ ...prev, [challengeIndex]: 'hard' }));
                        nextChallengeItem();
                      }}
                      className="px-5 py-2.5 text-sm font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                      Դժվար էր / Չհասցրի
                    </button>
                    <button
                      onClick={() => {
                        setChallengeScores((prev) => ({ ...prev, [challengeIndex]: 'known' }));
                        nextChallengeItem();
                      }}
                      className="px-5 py-2.5 text-sm font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5"
                    >
                      <Check className="w-4 h-4" /> Հասկացա ու պատասխանեցի
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center pt-2">
                  <button
                    onClick={() => {
                      if (timerRef.current) clearInterval(timerRef.current);
                      setIsTimerRunning(false);
                      setIsChallengeRevealed(true);
                    }}
                    className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors shadow-xs"
                  >
                    Ցույց տալ պատասխանն ու թարգմանությունը
                  </button>
                </div>
              )}
            </div>

            {/* Bottom game status */}
            <div className="flex items-center justify-between text-sm text-slate-500 mt-4 px-2">
              <span>🎯 Նպատակն է սովորել անմիջապես պատասխանել առանց երկար մտածելու</span>
              <button
                onClick={() => startChallengeRound(0)}
                className="text-amber-700 hover:underline font-semibold"
              >
                Սկսել նորից
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: 15 BONUS SURVIVAL PHRASES */}
        {viewMode === 'bonus' && (
          <div className="max-w-4xl mx-auto py-2">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 mb-6">
              <h2 className="text-lg sm:text-xl font-extrabold text-amber-900 mb-1 flex items-center gap-2">
                <span>15 frases para no quedarse callado</span>
                <span className="text-sm font-normal text-amber-800">
                  (15 կարճ արտահայտություն դպրոցում չլռելու համար)
                </span>
              </h2>
              <p className="text-sm sm:text-base text-amber-900/90 leading-relaxed">
                Երբ ուսուցիչը կամ դասընկերդ մի բան է հարցնում, և դու չես հասկանում կամ ժամանակ է պետք,
                երբեք մի՛ լռիր։ Օգտագործիր այս 15 արտահայտություններից մեկը։
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {BONUS_PHRASES.map((phrase) => (
                <div
                  key={phrase.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 hover:border-amber-300 transition-all flex flex-col justify-between shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-sm text-slate-400 font-bold">#{phrase.id}</span>
                    <button
                      onClick={() => speakText(phrase.es)}
                      className="p-1.5 text-slate-400 hover:text-amber-600 rounded-md hover:bg-slate-50"
                      title="Լսել արտասանությունը"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className={`${fontSizeMode === 'xl' ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} font-bold text-slate-900 mb-1.5`}>
                    {phrase.es}
                  </div>
                  <div className={`${fontSizeMode === 'xl' ? 'text-base sm:text-lg' : 'text-sm sm:text-base'} font-medium text-slate-700`}>
                    {phrase.arm}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-sm text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>
            Escucha y responde · 7.º curso (A1–B1) · Իսպաներեն և Հայերեն դպրոցական խոսակցական ուսուցիչ
          </p>
          <div className="flex items-center gap-4 text-slate-600 font-medium">
            <span>60 A1–A2 հարց</span>
            <span>·</span>
            <span>70 A2–B1 հարց</span>
            <span>·</span>
            <span>15 Ֆրազ</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
