/**
 * On-screen numeric keypad for the shared login PIN. The password is digits
 * only, so there is no text field to focus and no OS keyboard to wait for.
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

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
        onClick={() => onDigit('0')}
      >
        0
      </button>
      <button
        type="button"
        className="keypad-key keypad-back"
        disabled={disabled}
        aria-label="Delete last digit"
        onClick={onBackspace}
      >
        ⌫
      </button>
    </div>
  );
}
