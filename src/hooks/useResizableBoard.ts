import { useState, useRef, useCallback, useEffect } from 'react';

export function useResizableBoard(defaultMinPx: number = 336) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(() => {
    const saved = localStorage.getItem('ffa:draft_board_height');
    if (saved) {
      const val = parseInt(saved, 10);
      if (!isNaN(val) && val > 0) return val;
    }
    return null;
  });

  const minHeightRef = useRef<number>(defaultMinPx);

  useEffect(() => {
    if (scrollerRef.current) {
      const measured = scrollerRef.current.offsetHeight || defaultMinPx;
      if (measured > 0) {
        minHeightRef.current = measured;
      }
    }
  }, [defaultMinPx]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const minH = minHeightRef.current;
    const maxH = minH * 2;
    const startH = height ?? minH;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const nextH = Math.max(minH, Math.min(maxH, startH + deltaY));
      setHeight(nextH);
      localStorage.setItem('ffa:draft_board_height', String(nextH));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [height]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const startY = e.touches[0].clientY;
    const minH = minHeightRef.current;
    const maxH = minH * 2;
    const startH = height ?? minH;

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      const deltaY = moveEvent.touches[0].clientY - startY;
      const nextH = Math.max(minH, Math.min(maxH, startH + deltaY));
      setHeight(nextH);
      localStorage.setItem('ffa:draft_board_height', String(nextH));
    };

    const onTouchEnd = () => {
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  }, [height]);

  return {
    scrollerRef,
    height,
    handleMouseDown,
    handleTouchStart,
    style: height ? { maxHeight: `${height}px` } : undefined,
  };
}
