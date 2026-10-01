import { cx } from '../utils/cx.js';

/** Shimmering placeholder used while a real request is in flight. */
export default function Skeleton({ width = '100%', height = 16, radius, className, style }) {
  return (
    <div
      className={cx('skeleton', className)}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}
