const WINDOW_START_MINUTE = 0;
const WINDOW_END_MINUTE = 90;

function jstParts(date = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

const parts = jstParts();
const minute = Number(parts.hour) * 60 + Number(parts.minute);
if (minute < WINDOW_START_MINUTE || minute > WINDOW_END_MINUTE) {
  throw new Error(`Refusing daily collection at ${parts.hour}:${parts.minute} JST. Accepted observation window is 00:00-01:30 JST.`);
}

console.log(`Collection time accepted: ${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} JST (window 00:00-01:30).`);
