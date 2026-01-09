export function getCurrentTimeWithTimezone(timeSource: string) {
  const now = new Date();
  if (!timeSource || timeSource.toLowerCase() === 'local' || timeSource.toLowerCase() === 'false') {
    const offset = -now.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
    const timezoneStr = `${sign}${hours}:${minutes}`;

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezoneStr}`;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeSource,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: timeSource }));
    const offsetMinutes = (tzDate.getTime() - utcDate.getTime()) / 60000;

    const sign = offsetMinutes >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0');
    const minutes = String(Math.abs(offsetMinutes) % 60).padStart(2, '0');
    const timezoneStr = `${sign}${hours}:${minutes}`;

    return `${year}-${month}-${day}T${hour}:${minute}:${second}${timezoneStr}`;
  } catch (_error) {
    return getCurrentTimeWithTimezone('Local');
  }
}
