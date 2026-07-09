import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Scrolls a container to the bottom whenever `dependency` changes.
 * Intelligently pauses if the user has manually scrolled up.
 *
 * @param {{ enabled: boolean, dependency: any }} options
 * @returns {{ containerRef: React.RefObject }}
 */
export const useAutoScroll = ({ enabled = true, dependency }) => {
  const containerRef        = useRef(null);
  const userScrolledUpRef   = useRef(false);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Track whether the user has scrolled away from the bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledUpRef.current = distFromBottom > 80;
      setIsAtBottom(distFromBottom <= 80); 
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = useCallback((behaviour = 'smooth') => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top:      containerRef.current.scrollHeight,
        behavior: behaviour,
      });
    }
  }, []);

  // Scroll when new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (!enabled || userScrolledUpRef.current) return;
    const timer = setTimeout(() => scrollToBottom(), 60);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependency, enabled]);

  return { containerRef, scrollToBottom, isAtBottom };
};