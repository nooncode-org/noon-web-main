"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";

// Mockup: User Input Chat Interface
export function MockupChat({
  isActive = false,
  message = "Build me a dashboard for tracking sales metrics with real-time updates...",
}: {
  isActive?: boolean;
  message?: string;
}) {
  const [typedMessage, setTypedMessage] = useState("");

  useEffect(() => {
    if (!isActive) {
      setTypedMessage("");
      return;
    }
    let index = 0;
    const interval = setInterval(() => {
      if (index < message.length) {
        setTypedMessage(message.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [isActive, message]);

  return (
    <div className="w-full h-full flex flex-col bg-black/40 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[10px] text-gray-500 ml-2">new-project.noon</span>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 flex flex-col justify-end">
        {/* User message bubble */}
        <motion.div
          className="self-end max-w-[85%]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: isActive ? 1 : 0.3, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="bg-primary/20 border border-primary/30 rounded-2xl rounded-br-sm px-3 py-2">
            <p className="text-[11px] text-gray-200 leading-relaxed">
              {typedMessage}
              {isActive && typedMessage.length < message.length && (
                <motion.span
                  className="inline-block w-[2px] h-3 bg-primary ml-0.5"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Input bar */}
      <div className="px-3 py-2 border-t border-white/5">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
          <span className="text-[10px] text-gray-500">Describe what you want to build...</span>
        </div>
      </div>
    </div>
  );
}

// Mockup: Terminal with Maxwell logs
export function MockupTerminal({
  isActive = false,
  stage = "analyzing",
}: {
  isActive?: boolean;
  stage?: "idle" | "analyzing" | "routing" | "complete";
}) {
  const logs = {
    idle: [],
    analyzing: [
      { text: "[Maxwell] Initializing analysis pipeline...", color: "text-gray-400" },
      { text: "[Maxwell] Parsing user requirements...", color: "text-gray-400" },
      { text: "[Context] Business domain: SaaS Analytics", color: "text-blue-400" },
    ],
    routing: [
      { text: "[Maxwell] Initializing analysis pipeline...", color: "text-gray-400" },
      { text: "[Maxwell] Parsing user requirements...", color: "text-gray-400" },
      { text: "[Context] Business domain: SaaS Analytics", color: "text-blue-400" },
      { text: "[Route] → GPT-4: Specification generation", color: "text-emerald-400" },
      { text: "[Route] → V0: UI component scaffolding", color: "text-emerald-400" },
      { text: "[Route] → Opus: Technical refinement", color: "text-emerald-400" },
    ],
    complete: [
      { text: "[Maxwell] Initializing analysis pipeline...", color: "text-gray-400" },
      { text: "[Maxwell] Pipeline complete ✓", color: "text-emerald-400" },
      { text: "[Output] Ready for developer review", color: "text-primary" },
    ],
  };

  const currentLogs = logs[stage] || [];

  return (
    <div className="w-full h-full flex flex-col bg-black/60 rounded-lg overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/40">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[10px] text-gray-500 ml-2">maxwell — bash</span>
      </div>

      {/* Terminal content */}
      <div className="flex-1 p-3 overflow-hidden">
        {currentLogs.map((log, i) => (
          <motion.div
            key={i}
            className={`text-[10px] leading-relaxed ${log.color}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: isActive ? 1 : 0.4, x: 0 }}
            transition={{ delay: i * 0.15, duration: 0.3 }}
          >
            {log.text}
          </motion.div>
        ))}

        {/* Blinking cursor */}
        {isActive && stage !== "complete" && (
          <motion.span
            className="inline-block w-2 h-3 bg-emerald-400 mt-1"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  );
}

// Mockup: Specification Document
export function MockupSpec({
  isActive = false,
}: {
  isActive?: boolean;
}) {
  const sections = [
    { title: "Overview", content: "Real-time sales analytics dashboard" },
    { title: "Features", content: "• KPI cards\n• Revenue charts\n• User metrics" },
    { title: "Tech Stack", content: "Next.js, Tailwind, Recharts" },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-black/40 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary/30 flex items-center justify-center">
            <span className="text-[8px] text-primary">S</span>
          </div>
          <span className="text-[10px] text-gray-400">specification.md</span>
        </div>
        <span className="text-[9px] text-emerald-400">GPT-4</span>
      </div>

      {/* Document content */}
      <div className="flex-1 p-3 space-y-2 overflow-hidden">
        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: isActive ? 1 : 0.3, y: 0 }}
            transition={{ delay: i * 0.2, duration: 0.4 }}
          >
            <h4 className="text-[10px] font-medium text-gray-300 mb-0.5">{section.title}</h4>
            <p className="text-[9px] text-gray-500 whitespace-pre-line">{section.content}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Mockup: UI Preview (V0 output)
export function MockupUIPreview({
  isActive = false,
}: {
  isActive?: boolean;
}) {
  return (
    <div className="w-full h-full flex flex-col bg-black/40 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500/30 flex items-center justify-center">
            <span className="text-[8px] text-blue-400">v</span>
          </div>
          <span className="text-[10px] text-gray-400">preview</span>
        </div>
        <span className="text-[9px] text-blue-400">V0</span>
      </div>

      {/* UI Preview content */}
      <div className="flex-1 p-2 overflow-hidden">
        {/* Mini dashboard mockup */}
        <motion.div
          className="h-full bg-gray-900/50 rounded p-2 space-y-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: isActive ? 1 : 0.3 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div className="h-2 w-16 bg-white/10 rounded" />
            <div className="flex gap-1">
              <div className="h-2 w-2 bg-white/5 rounded" />
              <div className="h-2 w-2 bg-white/5 rounded" />
            </div>
          </div>

          {/* KPI cards row */}
          <div className="grid grid-cols-3 gap-1">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="h-8 bg-primary/10 border border-primary/20 rounded p-1"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: isActive ? 1 : 0.5 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.3 }}
              >
                <div className="h-1 w-6 bg-white/20 rounded mb-1" />
                <div className="h-2 w-8 bg-primary/40 rounded" />
              </motion.div>
            ))}
          </div>

          {/* Chart area */}
          <motion.div
            className="flex-1 bg-white/5 rounded p-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: isActive ? 1 : 0.3 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <svg viewBox="0 0 100 30" className="w-full h-full">
              <motion.path
                d="M0 25 Q25 20 50 15 T100 10"
                stroke="rgba(18, 0, 197, 0.6)"
                strokeWidth="1.5"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: isActive ? 1 : 0 }}
                transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
              />
            </svg>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// Mockup: Code Diff (Opus refinement)
export function MockupCodeDiff({
  isActive = false,
}: {
  isActive?: boolean;
}) {
  const diffLines = [
    { type: "context", text: "  const data = await fetchMetrics();" },
    { type: "removed", text: "-  return data;" },
    { type: "added", text: "+  return sanitizeData(data);" },
    { type: "added", text: "+  // Added type safety" },
    { type: "context", text: "  }" },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-black/40 rounded-lg overflow-hidden font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-orange-500/30 flex items-center justify-center">
            <span className="text-[8px] text-orange-400">O</span>
          </div>
          <span className="text-[10px] text-gray-400">refinements.diff</span>
        </div>
        <span className="text-[9px] text-orange-400">Opus</span>
      </div>

      {/* Diff content */}
      <div className="flex-1 p-2 overflow-hidden">
        {diffLines.map((line, i) => (
          <motion.div
            key={i}
            className={`text-[9px] leading-relaxed ${
              line.type === "added"
                ? "bg-emerald-500/10 text-emerald-400"
                : line.type === "removed"
                ? "bg-red-500/10 text-red-400"
                : "text-gray-500"
            }`}
            initial={{ opacity: 0, x: line.type === "added" ? 10 : line.type === "removed" ? -10 : 0 }}
            animate={{ opacity: isActive ? 1 : 0.3, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
          >
            {line.text}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// Mockup: Final Dashboard Output
export function MockupDashboard({
  isActive = false,
}: {
  isActive?: boolean;
}) {
  return (
    <div className="w-full h-full flex flex-col bg-black/40 rounded-lg overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/60">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 mx-2">
          <div className="bg-white/5 rounded-full px-3 py-0.5 text-[9px] text-gray-500">
            app.company.com/dashboard
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <motion.div
        className="flex-1 p-2 bg-gradient-to-br from-gray-900 to-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: isActive ? 1 : 0.3 }}
        transition={{ duration: 0.5 }}
      >
        {/* Sidebar */}
        <div className="flex gap-2 h-full">
          <div className="w-8 bg-white/5 rounded p-1 space-y-1">
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                className={`h-4 w-full rounded ${i === 0 ? "bg-primary/30" : "bg-white/5"}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 + i * 0.05, duration: 0.2 }}
              />
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-1.5">
            {/* Top stats */}
            <div className="grid grid-cols-4 gap-1">
              {[...Array(4)].map((_, i) => (
                <motion.div
                  key={i}
                  className="h-6 bg-white/5 rounded p-1"
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                >
                  <div className="h-1 w-4 bg-white/20 rounded mb-0.5" />
                  <div className="h-1.5 w-6 bg-primary/40 rounded" />
                </motion.div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-2 gap-1 flex-1">
              <motion.div
                className="bg-white/5 rounded p-1"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
              >
                <div className="h-1 w-8 bg-white/20 rounded mb-1" />
                <svg viewBox="0 0 50 20" className="w-full h-8">
                  <motion.path
                    d="M0 15 L10 12 L20 14 L30 8 L40 10 L50 5"
                    stroke="rgba(18, 0, 197, 0.8)"
                    strokeWidth="1"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: isActive ? 1 : 0 }}
                    transition={{ delay: 0.7, duration: 0.8 }}
                  />
                </svg>
              </motion.div>
              <motion.div
                className="bg-white/5 rounded p-1 flex items-end gap-0.5"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.4 }}
              >
                {[6, 8, 5, 10, 7, 9].map((h, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 bg-primary/40 rounded-t"
                    initial={{ height: 0 }}
                    animate={{ height: isActive ? h * 1.5 : 0 }}
                    transition={{ delay: 0.8 + i * 0.05, duration: 0.4 }}
                  />
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Status badge */}
      {isActive && (
        <motion.div
          className="absolute bottom-2 right-2 flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2 py-0.5"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1, duration: 0.3 }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[8px] text-emerald-400">Live</span>
        </motion.div>
      )}
    </div>
  );
}
