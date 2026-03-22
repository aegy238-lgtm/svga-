
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Calculates safe dimensions for video encoding (must be even numbers).
 */
export const calculateSafeDimensions = (width: number, height: number): Dimensions => {
  const safeWidth = Math.floor(width / 2) * 2;
  const safeHeight = Math.floor(height / 2) * 2;
  
  return {
    width: isNaN(safeWidth) || safeWidth <= 0 ? 1334 : safeWidth,
    height: isNaN(safeHeight) || safeHeight <= 0 ? 750 : safeHeight
  };
};

/**
 * Gets the default dimensions for a file based on its metadata.
 */
export const getDefaultDimensions = (metadata: any): Dimensions => {
  if (metadata?.dimensions?.width && metadata?.dimensions?.height) {
    return {
      width: metadata.dimensions.width,
      height: metadata.dimensions.height
    };
  }
  
  // Fallback to standard 1334x750 if no dimensions found
  return {
    width: 1334,
    height: 750
  };
};
