import type { MouseEvent } from "react";

// Where the last press on any window backdrop started. Module-level (not per
// call) so a re-render between mouse-down and click can't reset it.
let pressedBackdrop: EventTarget | null = null;

// Props for a window's dark backdrop: a click on the backdrop itself closes the
// window. The press must also start on the backdrop, so selecting text in a
// field and releasing the mouse outside the window doesn't close it.
export function backdropCloseProps(close: () => void) {
  return {
    onMouseDown: (e: MouseEvent) => {
      pressedBackdrop = e.target === e.currentTarget ? e.currentTarget : null;
    },
    onClick: (e: MouseEvent) => {
      const startedHere = pressedBackdrop === e.currentTarget;
      pressedBackdrop = null;
      if (startedHere && e.target === e.currentTarget) close();
    },
  };
}
