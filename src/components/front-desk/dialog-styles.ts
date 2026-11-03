/**
 * Shared surface and motion for the front desk's base-ui dialogs
 * (design.md §5.8 and §4.8). They match the native `dialog-motion` utility
 * used elsewhere: 200ms in, 150ms out, a fade plus a 0.96 scale from the
 * centre, and no scale under reduced motion. base-ui sets the
 * starting/ending style attributes and waits for the transition before it
 * unmounts the popup.
 */
export const DIALOG_BACKDROP_CLASS =
  "fixed inset-0 z-50 bg-overlay transition-opacity duration-200 ease-snappy data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:opacity-0 motion-reduce:transition-none";

export const DIALOG_POPUP_CLASS =
  "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-ink shadow-overlay outline-none transition-[opacity,scale] duration-200 ease-snappy data-[ending-style]:scale-96 data-[ending-style]:opacity-0 data-[ending-style]:duration-150 data-[starting-style]:scale-96 data-[starting-style]:opacity-0 motion-reduce:transition-opacity motion-reduce:data-[ending-style]:scale-100 motion-reduce:data-[starting-style]:scale-100";
