"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { getRandomExcerpt } from "@/lib/excerpts";
import { copy } from "clipboard";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { shareGameResult } from "@/app/actions/share";
import { useKeyboardSounds } from "@/lib/use-keyboard-sounds";
import { Volume2, VolumeX, Medal, Flag, Clock } from "lucide-react";
import Link from "next/link";
import { getTimerPreference, setTimerPreference } from "@/app/actions/timer-preference";

interface GameState {
  text: string;
  userInput: string;
  startTime: number | null;
  timer: number;
  isGameActive: boolean;
  isGameFinished: boolean;
  finalWPM: number;
  finalAccuracy: number;
}

interface GameResult {
  wpm: number;
  accuracy: number;
  duration: number;
  wpmHistory?: Array<{ time: number; wpm: number }>;
}

interface TypingGameProps {
  onGameFinish?: (result: GameResult) => void;
}

export function TypingGame({ onGameFinish }: TypingGameProps) {
  const [state, setState] = useState<GameState>({
    text: "", // Initialize with empty string to avoid hydration mismatch
    userInput: "",
    startTime: null,
    timer: 30,
    isGameActive: false,
    isGameFinished: false,
    finalWPM: 0,
    finalAccuracy: 0,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const [cursorPosition, setCursorPosition] = useState<{ left: number | string; top: number }>({ left: "-2", top: 2 });
  const [isCursorMoving, setIsCursorMoving] = useState(false);
  const cursorMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [currentWPM, setCurrentWPM] = useState(0);
  const [wpmHistory, setWpmHistory] = useState<Array<{ time: number; wpm: number }>>([]);
  
  // Race mode
  const [raceModeEnabled, setRaceModeEnabled] = useState(false);
  const [topEntry, setTopEntry] = useState<{ wpm: number; playerName: string | null } | null>(null);
  const [ghostCursorPosition, setGhostCursorPosition] = useState<{ left: number | string; top: number }>({ left: "-2", top: 2 });

  // Timer preference
  const [timerPreference, setTimerPreferenceState] = useState<15 | 30>(30);

  // Keyboard sounds
  const { playPressSound, playReleaseSound, enabled: soundEnabled, toggleSound } = useKeyboardSounds({ initialEnabled: true, volume: 0.9 });

  // Helper function to calculate correct characters
  const getCorrectChars = useCallback((userInput: string, text: string): number => {
    return userInput
      .split("")
      .filter((char, index) => char === text[index]).length;
  }, []);

  useEffect(() => {
    // Set random excerpt only on client side to avoid hydration mismatch
    setState((prev) => ({
      ...prev,
      text: getRandomExcerpt(),
    }));
    // Ensure input is focused on mount
    inputRef.current?.focus();
  }, []);

  // Load timer preference from database
  useEffect(() => {
    getTimerPreference().then((duration) => {
      setTimerPreferenceState(duration as 15 | 30);
      // Update timer to match preference if game hasn't started yet
      setState((prev) => ({
        ...prev,
        timer: duration,
      }));
    });
  }, []);

  // Fetch top leaderboard entry when race mode is enabled
  useEffect(() => {
    if (raceModeEnabled) {
      fetch("/api/leaderboard/top")
        .then((res) => res.json())
        .then((data) => {
          setTopEntry(data);
        })
        .catch((error) => {
          console.error("Error fetching top entry:", error);
        });
    }
  }, [raceModeEnabled]);

  // Track cursor movement state
  useEffect(() => {
    // Cursor is moving
    setIsCursorMoving(true);
    
    // Clear existing timeout
    if (cursorMoveTimeoutRef.current) {
      clearTimeout(cursorMoveTimeoutRef.current);
    }
    
    // Set cursor to stopped after 150ms of no movement
    cursorMoveTimeoutRef.current = setTimeout(() => {
      setIsCursorMoving(false);
    }, 150);
    
    return () => {
      if (cursorMoveTimeoutRef.current) {
        clearTimeout(cursorMoveTimeoutRef.current);
      }
    };
  }, [cursorPosition]);

  // Update cursor position when userInput changes
  // useLayoutEffect is appropriate here because we're measuring DOM layout
  // and need to update synchronously to prevent visual flickering
  useLayoutEffect(() => {
    if (!textContainerRef.current) return;

    const container = textContainerRef.current;
    const spans = container.querySelectorAll('span[data-char]');
    
    if (spans.length === 0) return;

    const currentIndex = state.userInput.length;
    
    if (currentIndex === 0) {
      // Cursor at the beginning
      setCursorPosition({ left: "-2", top: 0 });
    } else if (currentIndex < spans.length) {
      // Position cursor at the current character
      const targetSpan = spans[currentIndex] as HTMLElement;
      const rect = targetSpan.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      setCursorPosition({
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
      });
    } else {
      // Cursor at the end
      const lastSpan = spans[spans.length - 1] as HTMLElement;
      const rect = lastSpan.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      setCursorPosition({
        left: rect.right - containerRect.left,
        top: rect.top - containerRect.top,
      });
    }
  }, [state.userInput, state.text]);

  // Update ghost cursor position (similar to regular cursor)
  useLayoutEffect(() => {
    if (!textContainerRef.current || !raceModeEnabled || !topEntry) return;

    const container = textContainerRef.current;
    const spans = container.querySelectorAll('span[data-char]');
    
    if (spans.length === 0) return;

    // Ghost cursor tracks a virtual "input" at the speed of top entry
    // We'll update this based on game time
    const updateGhostCursor = () => {
      if (!state.isGameActive || !state.startTime) return;
      
      const elapsedMs = Date.now() - state.startTime;
      const wpm = topEntry.wpm;
      // Characters per second = (wpm * 5) / 60
      const charsPerSecond = (wpm * 5) / 60;
      const charactersTyped = Math.floor(elapsedMs / 1000 * charsPerSecond);
      
      if (charactersTyped === 0) {
        setGhostCursorPosition({ left: "-2", top: 0 });
      } else if (charactersTyped < spans.length) {
        const targetSpan = spans[charactersTyped] as HTMLElement;
        const rect = targetSpan.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        setGhostCursorPosition({
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
        });
      } else {
        const lastSpan = spans[spans.length - 1] as HTMLElement;
        const rect = lastSpan.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        setGhostCursorPosition({
          left: rect.right - containerRect.left,
          top: rect.top - containerRect.top,
        });
      }
    };

    const interval = setInterval(updateGhostCursor, 50);
    updateGhostCursor(); // Initial call
    
    return () => clearInterval(interval);
  }, [state.isGameActive, state.startTime, state.text, raceModeEnabled, topEntry]);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      console.log("Input changed:", value);
      
      setState((prev) => {
        const isFirstChar = prev.userInput === "" && value !== "";
        console.log("Is first char:", isFirstChar, "Game active:", prev.isGameActive);
        
        if (isFirstChar && !prev.isGameActive) {
          console.log("Starting game!");
          return {
            ...prev,
            isGameActive: true,
            startTime: Date.now(),
            userInput: value,
          };
        }
        
        return {
          ...prev,
          userInput: value,
        };
      });
    },
    []
  );

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (state.isGameActive && state.timer > 0) {
      interval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          timer: prev.timer - 1,
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [state.isGameActive, state.timer]);

  // Calculate WPM continuously during gameplay and store history
  useEffect(() => {
    if (state.isGameActive && state.startTime) {
      const calculateWPM = () => {
        const elapsedSeconds = (Date.now() - state.startTime!) / 1000;
        const elapsedMinutes = elapsedSeconds / 60;
        if (elapsedMinutes > 0) {
          const correctChars = getCorrectChars(state.userInput, state.text);
          const wpm = Math.min(Math.round((correctChars / 5) / elapsedMinutes), 999);
          setCurrentWPM(wpm);
          
          // Store WPM history (round time to nearest second)
          const timeSeconds = Math.floor(elapsedSeconds);
          setWpmHistory((prev) => {
            // Only add if this second hasn't been recorded yet, or update the latest entry for the same second
            const lastEntry = prev[prev.length - 1];
            if (lastEntry && lastEntry.time === timeSeconds) {
              // Update the latest entry
              return [...prev.slice(0, -1), { time: timeSeconds, wpm }];
            } else {
              // Add new entry
              return [...prev, { time: timeSeconds, wpm }];
            }
          });
        }
      };
      
      const interval = setInterval(calculateWPM, 100); // Update more frequently for smoother tracking
      calculateWPM(); // Calculate immediately
      
      return () => clearInterval(interval);
    } else if (!state.isGameActive) {
      // Reset history when game is not active
      setWpmHistory([]);
    }
  }, [state.isGameActive, state.startTime, state.userInput, state.text, getCorrectChars]);

  useEffect(() => {
    if (state.timer === 0 && state.isGameActive && !state.isGameFinished) {
      const calculateResults = () => {
        const endTime = Date.now();
        const duration = Math.floor((endTime - (state.startTime || endTime)) / 1000);
        const typedChars = state.userInput.length;
        const correctChars = getCorrectChars(state.userInput, state.text);
        const accuracy = typedChars > 0 ? Math.round((correctChars / typedChars) * 100) : 0;
        const wpm = duration > 0 ? Math.min(Math.round((correctChars / 5) / (duration / 60)), 999) : 0;

        return { wpm, accuracy, duration, wpmHistory };
      };

      const results = calculateResults();
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isGameFinished: true,
          finalWPM: results.wpm,
          finalAccuracy: results.accuracy,
        }));
        onGameFinish?.(results);
      }, 0);
    }
  }, [state.timer, state.isGameActive, state.isGameFinished, state.userInput, state.text, state.startTime, onGameFinish, getCorrectChars, wpmHistory]);

  useEffect(() => {
    // Finish game when user completes the excerpt
    if (state.userInput.length === state.text.length && state.isGameActive && !state.isGameFinished) {
      const calculateResults = () => {
        const endTime = Date.now();
        const duration = Math.floor((endTime - (state.startTime || endTime)) / 1000);
        const typedChars = state.userInput.length;
        const correctChars = getCorrectChars(state.userInput, state.text);
        const accuracy = typedChars > 0 ? Math.round((correctChars / typedChars) * 100) : 0;
        const wpm = duration > 0 ? Math.min(Math.round((correctChars / 5) / (duration / 60)), 999) : 0;

        return { wpm, accuracy, duration, wpmHistory };
      };

      const results = calculateResults();
      setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isGameFinished: true,
          finalWPM: results.wpm,
          finalAccuracy: results.accuracy,
        }));
        onGameFinish?.(results);
      }, 0);
    }
  }, [state.userInput, state.text, state.isGameActive, state.isGameFinished, state.startTime, onGameFinish, getCorrectChars, wpmHistory]);

  const handleRestart = () => {
    setState({
      text: getRandomExcerpt(),
      userInput: "",
      startTime: null,
      timer: timerPreference, // Use the user's timer preference
      isGameActive: false,
      isGameFinished: false,
      finalWPM: 0,
      finalAccuracy: 0,
    });
    setCurrentWPM(0);
    setWpmHistory([]);
    setGhostCursorPosition({ left: "-2", top: 2 });
    inputRef.current?.focus();
  };

  const handleShare = async () => {
    const id = nanoid(8);

    // Optimistically copy to clipboard and show success
    const shareUrl = `${window.location.origin}/s/${id}`;
    await copy(shareUrl);
    toast.success("Link copied to clipboard!");

    // Save to database in the background
    try {
      await shareGameResult({
        shortId: id,
        wpm: state.finalWPM,
        accuracy: state.finalAccuracy,
        duration: timerPreference - state.timer, // Use timer preference for accurate duration
        wpmHistory: wpmHistory.length > 0 ? wpmHistory : undefined,
      });
    } catch {
      toast.error("Failed to save results");
    }
  };

  const handleTimerToggle = async () => {
    const newDuration = timerPreference === 30 ? 15 : 30;
    setTimerPreferenceState(newDuration);

    // Update timer if game hasn't started yet
    if (!state.isGameActive) {
      setState((prev) => ({
        ...prev,
        timer: newDuration,
      }));
    }

    // Save preference to database (only for logged-in users)
    try {
      await setTimerPreference(newDuration);
      toast.success(`Timer set to ${newDuration} seconds`);
    } catch (error) {
      // If user is not logged in, just update locally
      toast.info(`Timer set to ${newDuration} seconds (sign in to save preference)`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      handleRestart();
      return;
    }
    
    // Play press sound for printable characters, backspace, enter, and space
    // Only play on initial press, not on key repeat
    if (!e.repeat && (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter")) {
      playPressSound(e.key);
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    // Play release sound for printable characters, backspace, enter, and space
    if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
      playReleaseSound(e.key);
    }
  };

  const handleClick = () => {
    inputRef.current?.focus();
  };

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen p-4"
      onClick={handleClick}
    >
      <div className="max-w-4xl w-full mb-8">
        <div className="relative">
          <div 
            ref={textContainerRef}
            className="text-large leading-relaxed break-words font-mono"
            role="textbox"
            aria-label="Text to type"
          >
            {state.text.split("").map((char, index) => {
              const userChar = state.userInput[index];
              let className = "text-muted-foreground/40"; // Less opacity on non-typed text

              if (userChar) {
                className = userChar === char ? "text-foreground" : "text-orange-500"; // Black for correct, orange for errors
              }

              return (
                <span key={index} data-char className={className}>
                  {char}
                </span>
              );
            })}
          </div>
          
          {/* Animated cursor */}
          <div
            className={`absolute w-[3px] h-8 pointer-events-none ${
              state.isGameFinished 
                ? 'bg-black dark:bg-white' 
                : 'bg-blue-500'
            } ${!isCursorMoving && !state.isGameFinished ? 'animate-cursor-blink' : ''}`}
            style={{
              left: `${cursorPosition.left}px`,
              top: `${cursorPosition.top + 2}px`,
              transition: 'left 0.1s ease-out, top 0.1s ease-out',
            }}
          />
          
          {/* Ghost cursor (race mode) */}
          {raceModeEnabled && topEntry && state.isGameActive && !state.isGameFinished && (
            <div 
              className="absolute pointer-events-none" 
              style={{ 
                left: `${ghostCursorPosition.left}px`, 
                top: `${ghostCursorPosition.top + 2}px`,
                transition: 'left 0.15s ease-out, top 0.15s ease-out',
              }}
            >
              {/* Player name label above cursor */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1">
                <div className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded whitespace-nowrap">
                  {topEntry.playerName || "Anonymous"}
                </div>
              </div>
              {/* Purple cursor line */}
              <div className="w-[3px] h-8 bg-purple-500" />
            </div>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={state.userInput}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        autoFocus
        disabled={state.isGameFinished}
        className="sr-only"
        aria-label="Type the text shown above"
      />

      {/* Timer/Share, WPM, and Restart grouped together - always rendered to reserve space */}
      <div className={`flex flex-col md:flex-row items-center justify-end gap-6 mt-8 text-large w-full max-w-4xl transition-opacity ${!state.isGameActive && !state.isGameFinished ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {state.isGameFinished ? (
          <button
            onClick={handleShare}
            className="text-orange-500 cursor-pointer hover:text-orange-600 transition-colors bg-transparent border-none p-0"
            aria-label="Share your typing test results"
          >
            Share
          </button>
        ) : (
          <span className="text-muted-foreground tabular-nums">{state.timer || timerPreference}</span>
        )}
        <span className="text-muted-foreground tabular-nums w-36 text-right">
          {state.isGameFinished ? state.finalWPM : currentWPM} WPM
        </span>
        <button
          onClick={handleRestart}
          className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors bg-transparent border-none p-0"
          aria-label="Restart typing test"
        >
          Restart
        </button>
      </div>

      {/* Leaderboard button - bottom right */}
      <Link
        href="/leaderboard"
        className="fixed bottom-4 right-28 w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label="View leaderboard"
      >
        <Medal className="w-5 h-5" strokeWidth={1.5} />
      </Link>

      {/* Timer toggle button - bottom right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleTimerToggle();
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="fixed bottom-4 right-20 w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors relative group"
        aria-label={`Switch to ${timerPreference === 30 ? 15 : 30} second timer`}
      >
        <Clock className="w-5 h-5" strokeWidth={1.5} />
        <span className="absolute -top-1 -right-1 text-[10px] font-bold bg-background px-0.5 rounded">
          {timerPreference}
        </span>
      </button>

      {/* Race flag button - bottom right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setRaceModeEnabled(!raceModeEnabled);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={`fixed bottom-4 right-12 w-8 h-8 flex items-center justify-center transition-colors ${
          raceModeEnabled
            ? 'text-purple-500 hover:text-purple-600'
            : 'text-muted-foreground/60 hover:text-muted-foreground'
        }`}
        aria-label={raceModeEnabled ? "Disable race mode" : "Enable race mode"}
      >
        <Flag className="w-5 h-5" />
      </button>

      {/* Sound toggle button - bottom right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleSound();
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="fixed bottom-4 right-4 w-8 h-8 flex items-center justify-center text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label={soundEnabled ? "Mute keyboard sounds" : "Unmute keyboard sounds"}
      >
        {soundEnabled ? (
          <Volume2 className="w-5 h-5" />
        ) : (
          <VolumeX className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}

