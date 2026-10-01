/** Join class names, ignoring falsy values. */
export function cx(...values) {
  return values.filter(Boolean).join(' ');
}

export default cx;
