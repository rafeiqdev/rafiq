"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, HTMLMotionProps, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface WordRotateProps {
  /**
   * Words or phrases to rotate through.
   */
  words: string[];
  /**
   * Duration in milliseconds before switching to the next word.
   * @default 2400
   */
  duration?: number;
  /**
   * Framer motion animation properties.
   */
  framerProps?: HTMLMotionProps<"span">;
  /**
   * Optional custom CSS class name.
   */
  className?: string;
  /**
   * HTML element type to render.
   * @default "span"
   */
  as?: React.ElementType;
}

export function WordRotate({
  words,
  duration = 2400,
  framerProps = {
    initial: { opacity: 0, y: 16, filter: "blur(6px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)" },
    exit: { opacity: 0, y: -16, filter: "blur(6px)" },
    transition: { type: "spring", stiffness: 280, damping: 24, mass: 0.8 },
  },
  className,
  as: Component = "span",
}: WordRotateProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!words || words.length <= 1) return;

    const interval = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % words.length);
    }, duration);

    return () => clearInterval(interval);
  }, [words, duration]);

  if (!words || words.length === 0) return null;

  const MotionComponent = motion(Component as any);

  return (
    <span className="inline-flex items-center overflow-hidden align-baseline">
      <AnimatePresence mode="wait" initial={false}>
        <MotionComponent
          key={words[index]}
          className={cn("inline-block", className)}
          {...framerProps}
        >
          {words[index]}
        </MotionComponent>
      </AnimatePresence>
    </span>
  );
}

export default WordRotate;
