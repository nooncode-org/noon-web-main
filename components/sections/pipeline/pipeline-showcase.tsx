"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { MessageSquare, Cpu, Sparkles, Code2, Layers, CheckCircle } from "lucide-react";
import { PipelineNode, MiniPipelineNode } from "./pipeline-node";
import { AnimatedConnection, BranchConnection } from "./animated-connection";
import {
  MockupChat,
  MockupTerminal,
  MockupSpec,
  MockupUIPreview,
  MockupCodeDiff,
  MockupDashboard,
} from "./mockups";

type PipelineStage = "idle" | "input" | "maxwell" | "ai-models" | "output" | "complete";

export function PipelineShowcase() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });
  const [currentStage, setCurrentStage] = useState<PipelineStage>("idle");
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  // Auto-play sequence when in view
  useEffect(() => {
    if (isInView && !isAutoPlaying) {
      setIsAutoPlaying(true);
      const stages: PipelineStage[] = ["input", "maxwell", "ai-models", "output", "complete"];
      let currentIndex = 0;

      const interval = setInterval(() => {
        if (currentIndex < stages.length) {
          setCurrentStage(stages[currentIndex]);
          currentIndex++;
        } else {
          clearInterval(interval);
          // Reset and loop after a pause
          setTimeout(() => {
            setCurrentStage("idle");
            setIsAutoPlaying(false);
          }, 3000);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isInView, isAutoPlaying]);

  const isStageActive = (stage: PipelineStage) => currentStage === stage;
  const isStageComplete = (stage: PipelineStage) => {
    const stageOrder: PipelineStage[] = ["idle", "input", "maxwell", "ai-models", "output", "complete"];
    return stageOrder.indexOf(currentStage) > stageOrder.indexOf(stage);
  };

  return (
    <section
      ref={containerRef}
      className="relative py-24 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(18,0,197,0.03) 50%, rgba(0,0,0,0) 100%)",
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="site-shell relative">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2 }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-primary">How Noon Works</span>
          </motion.div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight">
            From idea to production
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-primary">
              in record time
            </span>
          </h2>

          <p className="text-gray-400 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            Maxwell orchestrates multiple AI models to transform your requirements into
            production-ready software, with every line validated by senior engineers.
          </p>
        </motion.div>

        {/* Pipeline visualization - Desktop */}
        <div className="hidden lg:block">
          <div className="flex items-center justify-center gap-2">
            {/* Stage 1: User Input */}
            <PipelineNode
              label="Your Request"
              sublabel="Natural language"
              icon={<MessageSquare className="w-3 h-3" />}
              isActive={isStageActive("input")}
              isComplete={isStageComplete("input")}
              delay={0.2}
              size="md"
            >
              <MockupChat isActive={isStageActive("input") || isStageComplete("input")} />
            </PipelineNode>

            {/* Connection 1 */}
            <AnimatedConnection
              isActive={isStageComplete("input")}
              delay={0.4}
            />

            {/* Stage 2: Maxwell */}
            <PipelineNode
              label="Maxwell"
              sublabel="AI Orchestrator"
              icon={<Cpu className="w-3 h-3" />}
              isActive={isStageActive("maxwell")}
              isComplete={isStageComplete("maxwell")}
              delay={0.4}
              size="md"
            >
              <MockupTerminal
                isActive={isStageActive("maxwell") || isStageComplete("maxwell")}
                stage={isStageComplete("maxwell") ? "routing" : isStageActive("maxwell") ? "analyzing" : "idle"}
              />
            </PipelineNode>

            {/* Branch connection to 3 AI models */}
            <div className="relative">
              <BranchConnection isActive={isStageComplete("maxwell")} delay={0.6} />
            </div>

            {/* Stage 3: AI Models (vertical stack) */}
            <div className="flex flex-col gap-2">
              <MiniPipelineNode
                label="GPT-4"
                color="#10b981"
                icon={<Sparkles className="w-2.5 h-2.5 text-emerald-400" />}
                isActive={isStageActive("ai-models")}
                delay={0.7}
              >
                <MockupSpec isActive={isStageActive("ai-models") || isStageComplete("ai-models")} />
              </MiniPipelineNode>

              <MiniPipelineNode
                label="V0"
                color="#3b82f6"
                icon={<Layers className="w-2.5 h-2.5 text-blue-400" />}
                isActive={isStageActive("ai-models")}
                delay={0.8}
              >
                <MockupUIPreview isActive={isStageActive("ai-models") || isStageComplete("ai-models")} />
              </MiniPipelineNode>

              <MiniPipelineNode
                label="Opus"
                color="#f97316"
                icon={<Code2 className="w-2.5 h-2.5 text-orange-400" />}
                isActive={isStageActive("ai-models")}
                delay={0.9}
              >
                <MockupCodeDiff isActive={isStageActive("ai-models") || isStageComplete("ai-models")} />
              </MiniPipelineNode>
            </div>

            {/* Merge connection */}
            <div className="relative">
              <svg width="80" height="100" viewBox="0 0 80 100" className="overflow-visible">
                <motion.path
                  d="M0 10 Q40 10 60 50 L80 50"
                  stroke={isStageComplete("ai-models") ? "rgba(18, 0, 197, 0.5)" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isStageComplete("maxwell") ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: 1 }}
                />
                <motion.path
                  d="M0 50 L80 50"
                  stroke={isStageComplete("ai-models") ? "rgba(18, 0, 197, 0.5)" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isStageComplete("maxwell") ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: 1.1 }}
                />
                <motion.path
                  d="M0 90 Q40 90 60 50 L80 50"
                  stroke={isStageComplete("ai-models") ? "rgba(18, 0, 197, 0.5)" : "rgba(255, 255, 255, 0.1)"}
                  strokeWidth="2"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: isStageComplete("maxwell") ? 1 : 0 }}
                  transition={{ duration: 0.6, delay: 1.2 }}
                />
              </svg>
            </div>

            {/* Stage 4: Output */}
            <PipelineNode
              label="Production Ready"
              sublabel="Human validated"
              icon={<CheckCircle className="w-3 h-3" />}
              isActive={isStageActive("output") || isStageActive("complete")}
              isComplete={isStageComplete("output")}
              delay={1.2}
              size="lg"
            >
              <MockupDashboard isActive={isStageActive("output") || isStageActive("complete")} />
            </PipelineNode>
          </div>
        </div>

        {/* Pipeline visualization - Mobile/Tablet (vertical) */}
        <div className="lg:hidden">
          <div className="flex flex-col items-center gap-4">
            {/* Stage 1: User Input */}
            <PipelineNode
              label="Your Request"
              sublabel="Natural language"
              icon={<MessageSquare className="w-3 h-3" />}
              isActive={isStageActive("input")}
              isComplete={isStageComplete("input")}
              delay={0.2}
              size="lg"
            >
              <MockupChat isActive={isStageActive("input") || isStageComplete("input")} />
            </PipelineNode>

            <AnimatedConnection direction="vertical" isActive={isStageComplete("input")} delay={0.3} />

            {/* Stage 2: Maxwell */}
            <PipelineNode
              label="Maxwell"
              sublabel="AI Orchestrator"
              icon={<Cpu className="w-3 h-3" />}
              isActive={isStageActive("maxwell")}
              isComplete={isStageComplete("maxwell")}
              delay={0.4}
              size="lg"
            >
              <MockupTerminal
                isActive={isStageActive("maxwell") || isStageComplete("maxwell")}
                stage={isStageComplete("maxwell") ? "routing" : isStageActive("maxwell") ? "analyzing" : "idle"}
              />
            </PipelineNode>

            <AnimatedConnection direction="vertical" isActive={isStageComplete("maxwell")} delay={0.5} />

            {/* Stage 3: AI Models (horizontal on mobile) */}
            <div className="flex gap-3 overflow-x-auto pb-2 w-full justify-center">
              <MiniPipelineNode
                label="GPT-4"
                color="#10b981"
                icon={<Sparkles className="w-2.5 h-2.5 text-emerald-400" />}
                isActive={isStageActive("ai-models")}
                delay={0.6}
              >
                <MockupSpec isActive={isStageActive("ai-models") || isStageComplete("ai-models")} />
              </MiniPipelineNode>

              <MiniPipelineNode
                label="V0"
                color="#3b82f6"
                icon={<Layers className="w-2.5 h-2.5 text-blue-400" />}
                isActive={isStageActive("ai-models")}
                delay={0.7}
              >
                <MockupUIPreview isActive={isStageActive("ai-models") || isStageComplete("ai-models")} />
              </MiniPipelineNode>

              <MiniPipelineNode
                label="Opus"
                color="#f97316"
                icon={<Code2 className="w-2.5 h-2.5 text-orange-400" />}
                isActive={isStageActive("ai-models")}
                delay={0.8}
              >
                <MockupCodeDiff isActive={isStageActive("ai-models") || isStageComplete("ai-models")} />
              </MiniPipelineNode>
            </div>

            <AnimatedConnection direction="vertical" isActive={isStageComplete("ai-models")} delay={0.9} />

            {/* Stage 4: Output */}
            <PipelineNode
              label="Production Ready"
              sublabel="Human validated"
              icon={<CheckCircle className="w-3 h-3" />}
              isActive={isStageActive("output") || isStageActive("complete")}
              isComplete={isStageComplete("output")}
              delay={1}
              size="lg"
            >
              <MockupDashboard isActive={isStageActive("output") || isStageActive("complete")} />
            </PipelineNode>
          </div>
        </div>

        {/* Stats band */}
        <motion.div
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1.5, duration: 0.6 }}
        >
          {[
            { value: "3x", label: "Faster Delivery", sublabel: "vs traditional dev" },
            { value: "100%", label: "Real Code", sublabel: "No low-code limits" },
            { value: "24h", label: "First Prototype", sublabel: "For qualified projects" },
            { value: "100%", label: "Human QA", sublabel: "Every line reviewed" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 1.6 + i * 0.1, duration: 0.4 }}
            >
              <p className="text-2xl md:text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm font-medium text-gray-300">{stat.label}</p>
              <p className="text-xs text-gray-500">{stat.sublabel}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
