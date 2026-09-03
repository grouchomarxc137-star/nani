/**
 * On-screen numeric keypad for the shared login PIN. It mirrors the hidden
 * input in Login: tapping a key does not move focus (so a phone's numeric
 * keyboard, if open, stays open), it just reports the digit.
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// Keep focus where it is when a key is tapped.
function keepFocus(event: React.MouseEvent) {
  event.preventDefault();
}

export function Keypad({
  onDigit,
  onBackspace,
  disabled,
}: {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="keypad" role="group" aria-label="PIN keypad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          className="keypad-key"
          disabled={disabled}
          onMouseDown={keepFocus}
          onClick={() => onDigit(key)}
        >
          {key}
        </button>
      ))}
      <span aria-hidden="true" />
      <button
        type="button"
        className="keypad-key"
        disabled={disabled}
        onMouseDown={keepFocus}
        onClick={() => onDigit('0')}
      >
        0
      </button>
      <button
        type="button"
        className="keypad-key keypad-back"
        disabled={disabled}
        aria-label="Delete last digit"
        onMouseDown={keepFocus}
        onClick={onBackspace}
      >
        ⌫
      </button>
    </div>
  );
}
