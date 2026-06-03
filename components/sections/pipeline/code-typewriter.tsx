"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useRef } from "react";

interface CodeTypewriterProps {
  code: string;
  language?: string;
  isActive?: boolean;
  speed?: number;
  className?: string;
  onComplete?: () => void;
}

export function CodeTypewriter({
  code,
  language = "typescript",
  isActive = false,
  speed = 30,
  className = "",
  onComplete,
}: CodeTypewriterProps) {
  const [displayedCode, setDisplayedCode] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const indexRef = useRef(0);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    indexRef.current = 0;
    const interval = setInterval(() => {
      if (indexRef.current < code.length) {
        setDisplayedCode(code.slice(0, indexRef.current + 1));
        indexRef.current += 1;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, speed);

    // Reset in cleanup (on deactivate/unmount) rather than synchronously in
    // the effect body, which the react-hooks rules flag as cascading setState.
    return () => {
      clearInterval(interval);
      setDisplayedCode("");
      indexRef.current = 0;
    };
  }, [isActive, code, speed, onComplete]);

  // Cursor blink
  useEffect(() => {
    const blink = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(blink);
  }, []);

  // Simple syntax highlighting
  const highlightCode = (text: string) => {
    if (!text) return null;
    
    const lines = text.split("\n");
    return lines.map((line, lineIndex) => {
      // Highlight keywords
      const highlighted = line
        .replace(
          /\b(const|let|var|function|return|import|export|from|async|await|if|else|for|while|class|interface|type)\b/g,
          '<span class="text-purple-400">$1</span>'
        )
        .replace(
          /\b(true|false|null|undefined)\b/g,
          '<span class="text-orange-400">$1</span>'
        )
        .replace(
          /(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g,
          '<span class="text-emerald-400">$&</span>'
        )
        .replace(
          /\/\/.*/g,
          '<span class="text-gray-500">$&</span>'
        )
        .replace(
          /\b(\d+)\b/g,
          '<span class="text-amber-400">$1</span>'
        );

      return (
        <div key={lineIndex} className="leading-relaxed">
          <span
            className="text-gray-300"
            dangerouslySetInnerHTML={{ __html: highlighted || "&nbsp;" }}
          />
        </div>
      );
    });
  };

  return (
    <motion.div
      className={`font-mono text-xs ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        {/* Language tag */}
        <div className="absolute -top-6 left-0 text-[10px] uppercase tracking-wider text-gray-500">
          {language}
        </div>
        
        {/* Code content */}
        <div className="whitespace-pre-wrap break-all">
          {highlightCode(displayedCode)}
          
          {/* Cursor */}
          {isActive && (
            <motion.span
              className="inline-block w-[2px] h-4 bg-primary ml-0.5 align-middle"
              animate={{ opacity: showCursor ? 1 : 0 }}
              transition={{ duration: 0.1 }}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Compact version for smaller mockups
export function MiniCodeBlock({
  lines,
  isActive = false,
  className = "",
}: {
  lines: string[];
  isActive?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      className={`font-mono text-[10px] leading-tight ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0.5 }}
      transition={{ duration: 0.4 }}
    >
      {lines.map((line, i) => (
        <motion.div
          key={i}
          className="text-gray-400"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, duration: 0.3 }}
        >
          <span className="text-gray-600 mr-2">{String(i + 1).padStart(2, "0")}</span>
          {line}
        </motion.div>
      ))}
    </motion.div>
  );
}
