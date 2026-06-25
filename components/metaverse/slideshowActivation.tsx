/** Slideshow texture sizing — VR uses smaller canvases to save GPU memory. */
export const slideshowBitmapMaxPx = (inXR: boolean) => (inXR ? 320 : 480);
export const slideshowCanvasWidth = (inXR: boolean) => (inXR ? 480 : 640);
