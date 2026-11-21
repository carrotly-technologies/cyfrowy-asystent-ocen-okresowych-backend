/**
 * Minimal iCalendar (RFC 5545) event for "Dodaj do kalendarza": works in
 * Outlook, Thunderbird, Google and Apple calendars, no library needed.
 * Times are local "floating" times (the office's time zone).
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
}

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
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cyfrowy Asystent Ocen Okresowych//PL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${local(event.date, event.time)}`,
    `DTEND:${local(event.date, event.time, event.durationMinutes)}`,
    `SUMMARY:${escape(event.summary)}`,
    `LOCATION:${escape(event.location)}`,
    `DESCRIPTION:${escape(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
