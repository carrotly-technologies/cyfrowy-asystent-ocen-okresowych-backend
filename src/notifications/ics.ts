/**
 * Minimal iCalendar (RFC 5545) event for "Dodaj do kalendarza": works in
 * Outlook, Thunderbird, Google and Apple calendars, no library needed.
 * Times are the office's local time with a TZID (Europe/Warsaw by default), so
 * calendars in another zone show the right hour.
 */
export interface IcsEvent {
  uid: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  summary: string;
  location: string;
  description: string;
  stamp: string; // ISO timestamp
  /** IANA zone of date/time; default Europe/Warsaw (a VTIMEZONE for it is included). */
  tzid?: string;
}

/** Central European Time with the EU daylight-saving rules (last Sunday of March / October). */
const VTIMEZONE_WARSAW = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Warsaw',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

const escape = (s: string) =>
  s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

function local(date: string, time: string, plusMinutes = 0): string {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(h * 60 + m + plusMinutes);
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15);
}

export function buildIcs(event: IcsEvent): string {
  const stamp = event.stamp.replace(/[-:]/g, '').replace(/\.\d+/, '');
  const tzid = event.tzid ?? 'Europe/Warsaw';
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cyfrowy Asystent Ocen Okresowych//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...(tzid === 'Europe/Warsaw' ? VTIMEZONE_WARSAW : []),
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${tzid}:${local(event.date, event.time)}`,
    `DTEND;TZID=${tzid}:${local(event.date, event.time, event.durationMinutes)}`,
    `SUMMARY:${escape(event.summary)}`,
    `LOCATION:${escape(event.location)}`,
    `DESCRIPTION:${escape(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
