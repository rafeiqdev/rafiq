"use client";

import React, { useRef } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useVelocity,
  useAnimationFrame,
} from "framer-motion";
import { wrap } from "@motionone/utils";
import { cn } from "@/lib/utils";

export type MarqueeAnimationProps = {
  children: React.ReactNode;
  className?: string;
  direction?: "left" | "right";
  baseVelocity?: number;
};

function MarqueeAnimation({
  children,
  className,
  direction = "left",
  baseVelocity = 0.5,
}: MarqueeAnimationProps) {
  const baseX = useMotionValue(0);
  const { scrollY } = useScroll();
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 300,
  });
  const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 1.2], {
    clamp: true,
  });

  // Seamless wrap across 1 span cycle (25% for 4 identical spans)
  const x = useTransform(baseX, (v) => `${wrap(-25, 0, v)}%`);

  const directionFactor = useRef<number>(direction === "right" ? 1 : -1);

  useAnimationFrame((_t, delta) => {
    // Determine movement direction: -1 for leftward movement, +1 for rightward movement
    const dir = direction === "right" ? 1 : -1;
    directionFactor.current = dir;

    let moveBy = dir * Math.abs(baseVelocity) * (delta / 1000);
    moveBy += dir * Math.abs(moveBy) * velocityFactor.get();

    baseX.set(baseX.get() + moveBy);
  });

  return (
    <div
      dir="ltr"
      className="overflow-hidden w-full max-w-[100vw] whitespace-nowrap flex-nowrap flex relative select-none"
    >
      <motion.div
        className={cn(
          "font-bold uppercase text-2xl sm:text-3xl md:text-4xl flex flex-nowrap whitespace-nowrap *:flex *:items-center *:shrink-0 *:pe-8 sm:*:pe-14",
          className
        )}
        style={{ x }}
      >
        <span>{children}</span>
        <span>{children}</span>
        <span>{children}</span>
        <span>{children}</span>
      </motion.div>
    </div>
  );
}

export { MarqueeAnimation };

function MarqueeEffectDoubleExample() {
  return (
    <div className="flex flex-col gap-4">
      <MarqueeAnimation
        direction="left"
        baseVelocity={0.6}
        className="bg-green-500 text-white py-2"
      >
        Bundui Components
      </MarqueeAnimation>
      <MarqueeAnimation
        direction="right"
        baseVelocity={0.6}
        className="bg-purple-500 text-white py-2"
      >
        Bundui Components
      </MarqueeAnimation>
    </div>
  );
}

export { MarqueeEffectDoubleExample };
