import React, { useEffect, useRef } from 'react';
import katex from 'katex';

export default function KatexRenderer({ math, block = false, className = '' }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && math) {
      try {
        containerRef.current.innerHTML = '';
        katex.render(math, containerRef.current, {
          displayMode: block,
          throwOnError: false,
          output: 'html',
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
        containerRef.current.innerText = math;
      }
    }
  }, [math, block]);

  return (
    <span
      ref={containerRef}
      className={`inline-block select-text ${className}`}
    />
  );
}
