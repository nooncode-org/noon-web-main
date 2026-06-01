"use client";

import { Children, cloneElement, isValidElement, ReactNode } from "react";
import { useRevealOnView } from "@/hooks/use-reveal-on-view";

type StaggeredRevealProps = {
  children: ReactNode;
  staggerDelay?: number;
  initialDelay?: number;
  className?: string;
  threshold?: number;
  direction?: "up" | "down" | "left" | "right" | "scale";
};

export function StaggeredReveal({
  children,
  staggerDelay = 100,
  initialDelay = 0,
  className = "",
  threshold = 0.1,
  direction = "up",
}: StaggeredRevealProps) {
  const { ref, isVisible } = useRevealOnView<HTMLDivElement>({
    threshold,
    once: true,
  });

  const getTransform = (dir: string, visible: boolean) => {
    if (visible) return "translate(0, 0) scale(1)";
    switch (dir) {
      case "up":
        return "translateY(24px)";
      case "down":
        return "translateY(-24px)";
      case "left":
        return "translateX(24px)";
      case "right":
        return "translateX(-24px)";
      case "scale":
        return "scale(0.95)";
      default:
        return "translateY(24px)";
    }
  };

  const childArray = Children.toArray(children);

  return (
    <div ref={ref} className={className}>
      {childArray.map((child, index) => {
        if (!isValidElement(child)) return child;

        const delay = initialDelay + index * staggerDelay;

        return cloneElement(child as React.ReactElement<{ style?: React.CSSProperties; className?: string }>, {
          style: {
            ...(child.props as { style?: React.CSSProperties }).style,
            opacity: isVisible ? 1 : 0,
            transform: getTransform(direction, isVisible),
            transition: `opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
          },
        });
      })}
    </div>
  );
}
