import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Fetch calendar data from Convex
  const data = await fetchQuery(api.share.queries.getChildCalendar, {
    shareToken: token,
  });

  if (!data) {
    return new Response("Calendar not found", { status: 404 });
  }

  // Generate ICS content
  const ics = generateICS(data);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${data.childName}-camps.ics"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

function generateICS(data: {
  childName: string;
  familyName: string;
  events: {
    id: string;
    status: string;
    campName: string;
    organizationName: string;
    startDate: string;
    endDate: string;
    dropOffTime: { hour: number; minute: number };
    pickUpTime: { hour: number; minute: number };
    locationName: string;
    locationAddress: string;
  }[];
  familyEvents: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    eventType: string;
    location?: string;
  }[];
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PDX Camps//Camp Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${data.childName}'s Summer Camps`,
    `X-WR-CALDESC:Camp schedule for ${data.childName}`,
  ];

  // Add camp events - create daily events for each day of camp
  for (const event of data.events) {
    const startDate = new Date(event.startDate + "T12:00:00");
    const endDate = new Date(event.endDate + "T12:00:00");

    // Create an event for each weekday
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Skip weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const dateStr = formatDate(currentDate);
        const startTime = formatTime(event.dropOffTime);
        const endTime = formatTime(event.pickUpTime);

        const statusPrefix = event.status === "registered" ? "" :
          event.status === "waitlisted" ? "[WAITLIST] " : "[INTERESTED] ";

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${event.id}-${dateStr}@pdxcamps.com`);
        lines.push(`DTSTAMP:${formatDateTimeUTC(new Date())}`);
        lines.push(`DTSTART:${dateStr}T${startTime}00`);
        lines.push(`DTEND:${dateStr}T${endTime}00`);
        lines.push(`SUMMARY:${escapeICS(statusPrefix + event.campName)}`);
        lines.push(`DESCRIPTION:${escapeICS(`${event.organizationName}\\nDrop-off: ${formatTimeDisplay(event.dropOffTime)}\\nPick-up: ${formatTimeDisplay(event.pickUpTime)}`)}`);
        if (event.locationAddress) {
          lines.push(`LOCATION:${escapeICS(event.locationName + ", " + event.locationAddress)}`);
        } else if (event.locationName) {
          lines.push(`LOCATION:${escapeICS(event.locationName)}`);
        }
        lines.push("END:VEVENT");
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  // Add family events as all-day events
  for (const event of data.familyEvents) {
    const startDate = new Date(event.startDate + "T12:00:00");
    const endDate = new Date(event.endDate + "T12:00:00");
    // Add one day to end date for all-day events (ICS uses exclusive end)
    endDate.setDate(endDate.getDate() + 1);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@pdxcamps.com`);
    lines.push(`DTSTAMP:${formatDateTimeUTC(new Date())}`);
    lines.push(`DTSTART;VALUE=DATE:${formatDate(startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatDate(endDate)}`);
    lines.push(`SUMMARY:${escapeICS(event.title)}`);
    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.join("\r\n");
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatTime(time: { hour: number; minute: number }): string {
  return `${String(time.hour).padStart(2, "0")}${String(time.minute).padStart(2, "0")}`;
}

function formatTimeDisplay(time: { hour: number; minute: number }): string {
  const hour = time.hour % 12 || 12;
  const ampm = time.hour >= 12 ? "PM" : "AM";
  const min = time.minute > 0 ? `:${String(time.minute).padStart(2, "0")}` : "";
  return `${hour}${min} ${ampm}`;
}

function formatDateTimeUTC(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
