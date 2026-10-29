export function Toast({
  message,
  actionLabel,
  onAction,
  isError,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  isError?: boolean;
}) {
  return (
    <div className={`toast${isError ? ' is-error' : ''}`} role={isError ? 'alert' : 'status'}>
      <span>{message}</span>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
