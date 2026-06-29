import { useState, useEffect, useCallback } from "react";

type UseAntiCheatOptions = {
  isStrictMode: boolean;
  maxTabSwitches: number;
  onViolationExceeded?: () => void;
  onViolationWarning?: (currentSwitches: number, maxSwitches: number) => void;
};

export function useAntiCheat({
  isStrictMode,
  maxTabSwitches,
  onViolationExceeded,
  onViolationWarning
}: UseAntiCheatOptions) {
  const [tabSwitches, setTabSwitches] = useState(0);

  const handleViolation = useCallback(() => {
    if (!isStrictMode) return;

    setTabSwitches(prev => {
      const current = prev + 1;
      
      if (current > maxTabSwitches) {
        if (onViolationExceeded) {
          onViolationExceeded();
        }
      } else {
        if (onViolationWarning) {
          onViolationWarning(current, maxTabSwitches);
        }
      }
      
      return current;
    });
  }, [isStrictMode, maxTabSwitches, onViolationExceeded, onViolationWarning]);

  useEffect(() => {
    if (!isStrictMode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleViolation();
      }
    };

    const handleBlur = () => {
      // Small delay to ensure it's a real window blur and not just clicking inside an iframe
      setTimeout(() => {
        if (!document.hasFocus()) {
          handleViolation();
        }
      }, 100);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      // Optionally warn user
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      // Optionally warn user
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopy);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopy);
    };
  }, [isStrictMode, handleViolation]);

  return {
    tabSwitches,
    maxTabSwitches
  };
}
