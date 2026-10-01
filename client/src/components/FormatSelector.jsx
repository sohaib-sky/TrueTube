import { AudioLines, Clapperboard, Layers, TriangleAlert } from 'lucide-react';
import { useClickRipple } from '../hooks/useClickRipple.js';

/**
 * Format picker. Each button reflects a format the source actually returned;
 * nothing is offered speculatively.
 */
export default function FormatSelector({ groups, selected, onSelect, mergeAvailable, idPrefix = 'format' }) {
  // One ripple set for the whole list: every chip draws into the same surface
  // it is pressed on, so each press is tracked independently.
  const { ripples, pressedId, triggerPress, endPress } = useClickRipple();

  const renderChip = (option) => {
    const isSelected = selected?.id === option.id;
    const blocked = option.requiresFfmpeg && !mergeAvailable;
    const chipId = `${idPrefix}-${option.id}`;

    return (
      <button
        key={option.id}
        type="button"
        id={chipId}
        className="format-chip pressable"
        data-pressed={pressedId === chipId ? 'true' : undefined}
        aria-pressed={isSelected}
        onClick={() => onSelect(option)}
        onPointerDown={(event) => {
          triggerPress(event, chipId);
        }}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        title={blocked ? 'Requires FFmpeg on the server — a combined format will be recommended' : undefined}
      >
        {ripples
          .filter((ripple) => ripple.owner === chipId)
          .map((ripple) => (
            <span
              key={ripple.id}
              className="btn__ripple"
              aria-hidden="true"
              style={{ left: ripple.x, top: ripple.y, width: ripple.size, height: ripple.size }}
            />
          ))}

        <span className="format-chip__label">
          <span>{option.label}</span>
          {option.meta ? <span className="format-chip__meta">{option.meta}</span> : null}
          {option.requiresFfmpeg && !mergeAvailable ? (
            <span className="format-chip__badge">NEEDS FFMPEG</span>
          ) : null}
        </span>
      </button>
    );
  };

  return (
    <div className="formats">
      {groups.best ? (
        <div>
          <p className="formats__group-label">
            <Layers size={13} aria-hidden="true" /> Recommended
          </p>
          <div className="formats__chips">{renderChip(groups.best)}</div>
        </div>
      ) : null}

      {groups.video.length > 0 ? (
        <div>
          <p className="formats__group-label">
            <Clapperboard size={13} aria-hidden="true" /> Video
          </p>
          <div className="formats__chips" role="group" aria-label="Video formats">
            {groups.video.map(renderChip)}
          </div>
        </div>
      ) : null}

      {groups.audio.length > 0 ? (
        <div>
          <p className="formats__group-label">
            <AudioLines size={13} aria-hidden="true" /> Audio only
          </p>
          <div className="formats__chips" role="group" aria-label="Audio formats">
            {groups.audio.map(renderChip)}
          </div>
        </div>
      ) : null}

      {!mergeAvailable && (groups.best || groups.video.some((option) => option.requiresFfmpeg)) ? (
        <p className="formats__group-label" style={{ color: 'var(--warning)' }}>
          <TriangleAlert size={13} aria-hidden="true" />
          FFmpeg is not installed on this server, so options that merge the best video and audio streams are
          unavailable. Choose an audio-only or combined format.
        </p>
      ) : null}
    </div>
  );
}
