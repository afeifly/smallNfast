/**
 * Checks if the current viewport is in small-screen landscape mode
 * (e.g., iPhone 16 852x393, landscape phones <= 550px height, or window height <= 500px).
 */
export const isSmallLandscapeMode = () => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia) {
    return window.matchMedia('(max-height: 550px) and (orientation: landscape), (max-height: 500px)').matches;
  }
  return (window.innerHeight || 0) <= 550;
};
