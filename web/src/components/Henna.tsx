/** Henna's artwork is decorative; her message and pace are always readable text. */
export function Henna({ celebrate = false, className = '' }: { celebrate?: boolean; className?: string }) {
  return (
    <svg className={`henna ${celebrate ? 'henna-celebrate' : ''} ${className}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle cx="48" cy="48" r="43" fill="var(--henna-wash)" />
      <path d="M28 65 17 57 30 54" fill="var(--henna-deep)" />
      <ellipse cx="47" cy="52" rx="28" ry="29" fill="var(--henna)" />
      <circle cx="60" cy="31" r="20" fill="var(--henna)" />
      <ellipse cx="39" cy="59" rx="17" ry="18" fill="#d98558" transform="rotate(-22 39 59)" />
      <path d="m77 32 16 8-17 5" fill="#dca33f" />
      <circle cx="67" cy="27" r="2.8" fill="var(--ink)" />
      <path d="m38 77-4 10m21-10-3 10" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" />
      {celebrate && <path d="m14 16 2 6 6 2-6 2-2 6-2-6-6-2 6-2Zm70 47 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="var(--gold)" />}
    </svg>
  );
}
