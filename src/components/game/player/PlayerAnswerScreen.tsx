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
  optionIndices: number[];
}
export function PlayerAnswerScreen({ onAnswer, submittedAnswer, optionIndices }: PlayerAnswerScreenProps) {
  const buttonsToShow = submittedAnswer !== null
    ? optionIndices.filter(originalIndex => originalIndex === submittedAnswer)
    : optionIndices;
  return (
    <motion.div
      className="grid grid-cols-2 gap-4 w-full h-full"
      key="answer-screen"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      {buttonsToShow.map((originalIndex, displayIndex) => (
        <motion.button
          key={originalIndex}
          onClick={() => onAnswer(originalIndex)}
          disabled={submittedAnswer !== null}
          className={`rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200 ${shapeColors[originalIndex]} ${submittedAnswer !== null ? '' : 'hover:scale-105'}`}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: displayIndex * 0.1 }}
          layout
        >
          <svg viewBox="0 0 24 24" className="w-1/2 h-1/2 text-white fill-current"><path d={shapePaths[originalIndex]} /></svg>
        </motion.button>
      ))}
    </motion.div>
  );
}