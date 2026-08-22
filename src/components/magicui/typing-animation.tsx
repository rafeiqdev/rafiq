"use client";

import React, { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

export interface TypingAnimationProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Single text string to type out.
   */
  children?: string;
  /**
   * List of words or phrases to cycle through with typing and deleting animation.
   */
  words?: string[];
  /**
   * Speed of typing each character in milliseconds.
   * @default 30
   */
  typeSpeed?: number;
  /**
   * Speed of deleting each character in milliseconds.
   * @default 20
   */
  deleteSpeed?: number;
  /**
   * Delay in milliseconds to pause after typing a word before deleting it.
   * @default 1400
   */
  pauseDelay?: number;
  /**
   * Initial delay in milliseconds before typing begins.
   * @default 150
   */
  delay?: number;
  /**
   * Whether to loop infinitely across words.
   * @default true
   */
  loop?: boolean;
  /**
   * Whether to display a blinking cursor.
   * @default true
   */
  cursor?: boolean;
  /**
   * Custom cursor character or element.
   * @default "|"
   */
  cursorChar?: React.ReactNode;
  /**
   * Whether the cursor blinks.
   * @default true
   */
  blinkCursor?: boolean;
  /**
   * The HTML tag to render as.
   * @default "span"
   */
  as?: React.ElementType;
  /**
   * Start animation only when component is visible in viewport.
   * @default false
   */
  startOnView?: boolean;
  /**
   * Optional custom CSS class name.
   */
  className?: string;
  /**
   * Optional custom CSS class for the cursor.
   */
  cursorClassName?: string;
}

export const TypingAnimation: React.FC<TypingAnimationProps> = ({
  children,
  words: wordsProp,
  typeSpeed = 30,
  deleteSpeed = 20,
  pauseDelay = 1400,
  delay = 150,
  loop = true,
  cursor = true,
  cursorChar = "|",
  blinkCursor = true,
  as: Component = "span",
  startOnView = false,
  className,
  cursorClassName,
  ...props
}) => {
  // Normalize words array
  const words = wordsProp && wordsProp.length > 0 
    ? wordsProp 
    : children 
      ? [children] 
      : [];

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasStarted, setHasStarted] = useState(!startOnView);

  const containerRef = useRef<HTMLElement>(null);

  // Viewport intersection trigger
  useEffect(() => {
    if (!startOnView) {
      setHasStarted(true);
      return;
    }

    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry && entry.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [startOnView]);

  // Typing & Deleting state machine
  useEffect(() => {
    if (!hasStarted || words.length === 0) return;

    const currentWord = words[currentWordIndex] || "";
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      // Typing phase
      if (displayedText.length < currentWord.length) {
        timeout = setTimeout(() => {
          setDisplayedText(currentWord.slice(0, displayedText.length + 1));
        }, displayedText.length === 0 ? delay : typeSpeed);
      } else {
        // Word is complete
        const isLastWord = currentWordIndex === words.length - 1;
        if (!loop && isLastWord) {
          // If not looping and reached the end of the last word, stay there
          return;
        }

        // Only delete if there are multiple words or looping is enabled for a single word
        if (words.length > 1 || loop) {
          timeout = setTimeout(() => {
            setIsDeleting(true);
          }, pauseDelay);
        }
      }
    } else {
      // Deleting phase
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(currentWord.slice(0, displayedText.length - 1));
        }, deleteSpeed);
      } else {
        // Word is completely deleted -> switch to next word
        setIsDeleting(false);
        setCurrentWordIndex((prev) => (prev + 1) % words.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [
    hasStarted,
    words,
    currentWordIndex,
    displayedText,
    isDeleting,
    typeSpeed,
    deleteSpeed,
    pauseDelay,
    delay,
    loop,
  ]);

  return (
    <Component
      ref={containerRef}
      className={cn("inline-block relative text-inherit font-inherit", className)}
      {...props}
    >
      <span className="inline">{displayedText}</span>
      {cursor && (
        <span
          className={cn(
            "inline-block font-normal select-none pointer-events-none opacity-100",
            blinkCursor && "animate-pulse duration-700",
            cursorClassName
          )}
          style={{
            marginInlineStart: "0.15em",
            opacity: 0.85,
          }}
          aria-hidden="true"
        >
          {cursorChar}
        </span>
      )}
    </Component>
  );
};

export default TypingAnimation;
