import { useState, useEffect, useRef } from 'react';

interface UseTypewriterOptions {
  speed?: number;
  maxDurationMs?: number;
  onComplete?: () => void;
}

export function useTypewriter(
  fullText: string,
  options: UseTypewriterOptions = {},
) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const textRef = useRef(fullText);

  // Blinking terminal cursor
  useEffect(() => {
    const cursorTimer = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);
    return () => clearInterval(cursorTimer);
  }, []);

  useEffect(() => {
    textRef.current = fullText;
    setDisplayedText('');

    if (!fullText) {
      setIsTyping(false);
      return;
    }

    setIsTyping(true);

    // Adaptive speed: keep long messages snappy (max ~1.8s) while short ones feel deliberate
    const targetDuration = options.maxDurationMs ?? 1800;
    const baseSpeed =
      options.speed ??
      Math.max(10, Math.min(24, Math.floor(targetDuration / fullText.length)));

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex++;
      setDisplayedText(fullText.slice(0, currentIndex));

      if (currentIndex >= fullText.length) {
        clearInterval(interval);
        setIsTyping(false);
        options.onComplete?.();
      }
    }, baseSpeed);

    return () => clearInterval(interval);
  }, [fullText, options.speed, options.maxDurationMs]);

  return {
    displayedText,
    isTyping,
    cursorVisible,
  };
}
