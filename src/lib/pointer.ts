/**
 * "tap" under a mouse reads as though the page were written for someone else's device, and "click" is
 * just as wrong under a thumb. The hint lines are the only copy that names the gesture, so they ask.
 *
 * Read per render rather than once at module load: a tablet with a keyboard attached, or a laptop with
 * a touchscreen, can change which pointer is in use inside one session.
 */
export function pickVerb(): 'tap' | 'click' {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'tap' : 'click'
}
