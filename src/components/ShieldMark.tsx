export default function ShieldMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="hs-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#e5383b" />
        </linearGradient>
      </defs>
      <path d="M12 2 4 5v6c0 5.2 3.4 9.7 8 11 4.6-1.3 8-5.8 8-11V5l-8-3Z" fill="url(#hs-g)" />
      <path d="M8.5 12.5c1.2-1.6 2.3-1.6 3.5 0s2.3 1.6 3.5 0" stroke="#0a0d12" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M8.5 9c1.2-1.6 2.3-1.6 3.5 0s2.3 1.6 3.5 0" stroke="#0a0d12" strokeWidth="1.8" fill="none" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}
