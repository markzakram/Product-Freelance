// Ikon garis satu gaya untuk seluruh aplikasi — pengganti emoji, yang tampil
// beda-beda di tiap perangkat dan tidak bisa diwarnai mengikuti tema.
const P = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronLeft: <path d="M15 6l-6 6 6 6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7" /><path d="M6 7l1 12.2c.1.9.8 1.8 1.8 1.8h6.4c1 0 1.7-.9 1.8-1.8L18 7" /><path d="M10 11v6M14 11v6" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v9.5c0 .8.7 1.5 1.5 1.5h11c.8 0 1.5-.7 1.5-1.5V9" /><path d="M10 13h4" /></>,
  restore: <><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4.5h4.5" /></>,
  refresh: <><path d="M20 12a8 8 0 0 1-14.3 4.9" /><path d="M4 12a8 8 0 0 1 14.3-4.9" /><path d="M18.5 3.5v3.8h-3.8M5.5 20.5v-3.8h3.8" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  home: <><path d="M3 11.5L12 4l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.7.8 2.8 2.6 3.2 5.2" /></>,
  lock: <><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
  alert: <><path d="M12 4l9 16H3L12 4z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.3" /></>,
  bag: <><path d="M6 7h12l-1.2 11.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8Z" /><path d="M9 7V6a3 3 0 0 1 6 0v1" /></>,
  book: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  printer: <><path d="M7 9V3.5h10V9" /><rect x="3.5" y="9" width="17" height="8" rx="2" /><path d="M7 14h10v6.5H7z" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></>,
  send: <><path d="M21 3L10 14" /><path d="M21 3l-7 18-4-7-7-4z" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4" /></>,
  filter: <path d="M4 5h16l-6 8v5l-4 2v-7z" />,
};

export default function Icon({ name, size = 16, stroke = 1.8, className = "", title }) {
  const d = P[name];
  if (!d) return null;
  return (
    <svg
      className={"icon " + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {d}
    </svg>
  );
}
