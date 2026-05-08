"use client";

import { animate, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  value: number;
  className?: string;
};

export function AnimatedPoolCount({ value, className }: Props) {
  const [display, setDisplay] = useState(value);
  const prevTarget = useRef(value);
  const [glow, setGlow] = useState(false);

  useEffect(() => {
    const start = prevTarget.current;
    const increasing = value > start;
    prevTarget.current = value;
    if (increasing) {
      setGlow(true);
    }
    const controls = animate(start, value, {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
      onComplete: () => {
        if (increasing) {
          window.setTimeout(() => setGlow(false), 320);
        }
      },
    });
    return () => controls.stop();
  }, [value]);

  return (
    <motion.span
      className={cn(className)}
      animate={
        glow
          ? {
              textShadow: [
                "0 0 0 rgba(251, 146, 60, 0)",
                "0 0 18px rgba(251, 146, 60, 0.55)",
                "0 0 0 rgba(251, 146, 60, 0)",
              ],
              scale: [1, 1.03, 1],
            }
          : { textShadow: "0 0 0 rgba(251, 146, 60, 0)", scale: 1 }
      }
      transition={{ duration: 0.42, ease: "easeOut" }}
    >
      {display}
    </motion.span>
  );
}
