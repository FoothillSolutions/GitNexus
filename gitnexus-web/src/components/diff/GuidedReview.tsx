import { useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Check, Play, FileWarning, FileText, BarChart3 } from 'lucide-react';
import { useAppState } from '../../hooks/useAppState';

const STEPS = ['Summary', 'High Risk', 'Review Files', 'Complete'];

export const GuidedReview = () => {
  const {
    diffData, reviewFlowActive, reviewFlowStep, setReviewFlowStep,
    setReviewFlowActive, selectedDiffFile, setSelectedDiffFile,
  } = useAppState();

  if (!reviewFlowActive || !diffData) return null;

  const highRiskFiles = useMemo(() =>
    diffData.files.filter(f => f.symbols.some(s => s.changeScope === 'directly_changed')),
    [diffData.files],
  );

  const currentFileIdx = useMemo(() =>
    diffData.files.findIndex(f => f.filePath === selectedDiffFile),
    [diffData.files, selectedDiffFile],
  );

  const handleNext = useCallback(() => {
    if (reviewFlowStep === 0) {
      // Summary → High risk: navigate to first high-risk file
      setReviewFlowStep(1);
      if (highRiskFiles.length > 0) {
        setSelectedDiffFile(highRiskFiles[0].filePath);
      }
    } else if (reviewFlowStep === 1) {
      // High risk → Review files
      setReviewFlowStep(2);
    } else if (reviewFlowStep === 2) {
      // Next file
      if (currentFileIdx < diffData.files.length - 1) {
        setSelectedDiffFile(diffData.files[currentFileIdx + 1].filePath);
      } else {
        setReviewFlowStep(3);
      }
    }
  }, [reviewFlowStep, highRiskFiles, currentFileIdx, diffData.files, setReviewFlowStep, setSelectedDiffFile]);

  const handlePrev = useCallback(() => {
    if (reviewFlowStep === 3) {
      setReviewFlowStep(2);
    } else if (reviewFlowStep === 2 && currentFileIdx > 0) {
      setSelectedDiffFile(diffData.files[currentFileIdx - 1].filePath);
    } else if (reviewFlowStep > 0) {
      setReviewFlowStep(reviewFlowStep - 1);
    }
  }, [reviewFlowStep, currentFileIdx, diffData.files, setReviewFlowStep, setSelectedDiffFile]);

  const stepIcons = [BarChart3, FileWarning, FileText, Check];
  const StepIcon = stepIcons[reviewFlowStep] || FileText;

  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 border-t border-border-subtle bg-surface/80 backdrop-blur-sm">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                i < reviewFlowStep ? 'bg-green-500/20 text-green-400'
                : i === reviewFlowStep ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                : 'bg-elevated text-text-muted'
              }`}
            >
              {i < reviewFlowStep ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-4 h-px mx-0.5 ${i < reviewFlowStep ? 'bg-green-500/30' : 'bg-border-subtle'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Current step label */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <StepIcon className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
        <span className="text-xs text-text-primary font-medium truncate">
          {reviewFlowStep === 0 && 'Review Summary'}
          {reviewFlowStep === 1 && `High Risk Files (${highRiskFiles.length})`}
          {reviewFlowStep === 2 && `File ${currentFileIdx + 1} of ${diffData.files.length}`}
          {reviewFlowStep === 3 && 'Review Complete'}
        </span>
      </div>

      {/* Nav buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePrev}
          disabled={reviewFlowStep === 0}
          className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {reviewFlowStep === 3 ? (
          <button
            onClick={() => setReviewFlowActive(false)}
            className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded text-xs font-medium text-green-300 hover:bg-green-500/30 transition-colors"
          >
            Done
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-3 py-1 bg-amber-500/20 border border-amber-500/30 rounded text-xs font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};
