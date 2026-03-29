
'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface SlideToConfirmProps {
  onConfirm: () => void;
  text?: string;
  isConfirmationDisabled?: boolean;
}

export function SlideToConfirm({ 
  onConfirm, 
  text = "Slide to Confirm",
  isConfirmationDisabled = false
}: SlideToConfirmProps) {
  const x = useMotionValue(0);

  const onDragEnd = (event: any, info: any) => {
    if (info.offset.x > 150) {
      if (!isConfirmationDisabled) {
        onConfirm();
      }
      // Reset position after a short delay
      setTimeout(() => x.set(0), 500);
    } else {
      x.set(0);
    }
  };
  
  const background = useTransform(
    x,
    [0, 200],
    ["linear-gradient(90deg, #10B981, #34D399)", "linear-gradient(90deg, #10B981, #6EE7B7)"]
  );

  return (
    <motion.div
      className="relative w-full h-14 rounded-full bg-green-100 p-1.5 overflow-hidden"
      style={{ background }}
    >
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        style={{ opacity: useTransform(x, [0, 100], [1, 0]) }}
      >
        <span className="text-green-800 font-semibold">{text}</span>
      </motion.div>
      <motion.div
        className="w-11 h-11 bg-white rounded-full shadow-lg flex items-center justify-center cursor-grab"
        drag="x"
        dragConstraints={{ left: 0, right: 200 }}
        dragElastic={0.1}
        onDragEnd={onDragEnd}
        style={{ x }}
        whileTap={{ cursor: "grabbing" }}
      >
        <ChevronRight className="h-6 w-6 text-green-600" />
      </motion.div>
    </motion.div>
  );
}
