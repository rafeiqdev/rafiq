import { motion, type Variants } from 'framer-motion';
import type { ElementType } from 'react';

const BLUR_IN: Variants = {
  hidden: { opacity: 0, filter: 'blur(10px)', y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' },
  }),
};

interface TextAnimateProps {
  children: string;
  as?: ElementType;
  className?: string;
  /** Only 'blurIn' is implemented — kept as a prop for API parity with the MagicUI component this was adapted from. */
  animation?: 'blurIn';
}

/** Word-by-word blur-in text reveal, ported by hand (no external registry dependency — this app has no shadcn setup). */
export function TextAnimate({ children, as: Tag = 'p', className }: TextAnimateProps) {
  const words = children.split(' ');
  return (
    <Tag className={className} aria-label={children}>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <motion.span
            key={i}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={BLUR_IN}
            className="inline-block"
          >
            {word}
            {i !== words.length - 1 ? ' ' : ''}
          </motion.span>
        ))}
      </span>
    </Tag>
  );
}
