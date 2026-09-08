const paths = {
  photos: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  series: (
    <>
      <rect x="5" y="7" width="16" height="14" rx="2" />
      <path d="M3 17V5a2 2 0 0 1 2-2h12M8 16l4-4 6 6" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 6 9 7 9-7" />
    </>
  ),
  left: <path d="m14 5-7 7 7 7" />,
  right: <path d="m10 5 7 7-7 7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  large: <rect x="4" y="4" width="16" height="16" rx="2" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  filter: (
    <>
      <path d="M4 7h16M4 17h16" />
      <circle cx="8" cy="7" r="2" />
      <circle cx="16" cy="17" r="2" />
    </>
  ),
  zoom: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m15 15 6 6M7 10h6M10 7v6" />
    </>
  ),
};
export function PhotoAppIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
