
export interface Dimensions {
  width: number;
  height: number;
}

/**
 * Calculates safe dimensions for video encoding (must be even numbers).
 * Also ensures the total pixel count doesn't exceed AVC Level 5.1 limits (9,437,184 pixels).
 */
export const calculateSafeDimensions = (width: number, height: number, maxPixels: number = 9437184): Dimensions => {
  let safeWidth = Math.floor(width / 2) * 2;
  let safeHeight = Math.floor(height / 2) * 2;
  
  // Cap resolution if it exceeds maxPixels
  if (safeWidth * safeHeight > maxPixels) {
    const ratio = Math.sqrt(maxPixels / (safeWidth * safeHeight));
    safeWidth = Math.floor((safeWidth * ratio) / 2) * 2;
    safeHeight = Math.floor((safeHeight * ratio) / 2) * 2;
  }
  
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
