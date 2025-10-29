import { motion } from 'framer-motion';
const shapeColors = [
  'bg-quiz-red',    // Triangle
  'bg-quiz-blue',   // Diamond
  'bg-quiz-yellow', // Circle
  'bg-quiz-pink',   // Square
];
const shapePaths = [
  "M12 2L2 22h20L12 2z", // Triangle
  "M12 2l10 10-10 10-10-10L12 2z", // Diamond
  "M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z", // Circle
  "M2 2h20v20H2V2z" // Square
];
interface PlayerAnswerScreenProps {
  onAnswer: (index: number) => void;
  submittedAnswer: number | null;
  answerCount: number;
}
export function PlayerAnswerScreen({ onAnswer, submittedAnswer, answerCount }: PlayerAnswerScreenProps) {
  return (
    <div className="grid grid-cols-2 gap-4 w-full h-full">
      {shapeColors.slice(0, answerCount).map((color, i) => (
        <motion.button
          key={i}
          onClick={() => onAnswer(i)}
          disabled={submittedAnswer !== null}
          className={`rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 ${color} ${submittedAnswer !== null && submittedAnswer !== i ? 'opacity-25 scale-90' : 'hover:scale-105'}`}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-white fill-current"><path d={shapePaths[i]} /></svg>
        </motion.button>
      ))}
    </div>
  );
}