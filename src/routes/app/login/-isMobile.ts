// iPadOS Safari sends a Mac user agent, so a Mac with a touch screen is an iPad.
export const isMobile = (userAgent: string, maxTouchPoints: number) =>
  /Android|iPhone|iPad|iPod/.test(userAgent) ||
  (userAgent.includes('Macintosh') && maxTouchPoints > 1)
