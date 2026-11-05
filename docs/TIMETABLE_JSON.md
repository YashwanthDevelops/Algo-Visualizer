# Timetable JSON upload

Open Timetabling → Dataset & JSON → Choose JSON file. A valid file loads and generates a timetable automatically. Use Download example JSON on the same panel for a complete sample.

The file must be a raw dataset object with `slots`, `rooms`, `teachers`, and `sessions`. Maximum file size: 256 KB. No file is sent to a server.

```json
{
  "slots": ["Mon 09:00", "Mon 10:00"],
  "rooms": [{"id": "R1", "available": [0, 1]}],
  "teachers": [{"id": "Ada", "available": [0, 1]}],
  "sessions": [
    {"id": "M1", "name": "Mathematics", "teacher": "Ada", "group": "A", "rooms": ["R1"]},
    {"id": "M2", "name": "Mathematics practice", "teacher": "Ada", "group": "A", "rooms": ["R1"]}
  ]
}
```

- `slots`: 1–84 unique time labels, in schedule order. Each represents one equal scheduling unit.
- `rooms`: 1–6 objects with unique string IDs and availability arrays.
- `teachers`: objects with unique string IDs and availability arrays.
- `available`: unique zero-based slot indexes; `0` means the first entry in `slots`. An empty list means unavailable in every slot.
- `sessions`: 1–64 objects. Each needs a unique `id`, a `name`, a known `teacher`, a `group`, and a non-empty `rooms` list of known room IDs. Represent repeated classes as separate sessions with different IDs.
- A session may include `available`, a list of allowed zero-based slot indexes. Omit it to allow any slot permitted by its teacher and rooms. Use it to keep a class on a specific day. An empty list means the session has no possible period.
- Breaks can be represented as labeled time slots omitted from room and teacher availability.
- All labels and IDs must be non-empty strings, at most 160 characters.

The solver assigns every session one time slot and one allowed room. It respects teacher and room availability and prevents simultaneous sessions from sharing a teacher, group, or room.

A complete timetable satisfies all these constraints. The solver returns the first feasible solution; it does not optimize gaps or preferences. Session durations, room capacities, and preference scores are not part of this format. Unsupported fields are rejected rather than silently ignored.

An exhaustive failed search reports that no feasible timetable exists. A search limit reports that feasibility is still unknown. Limits and variable/value ordering can be changed under Advanced settings at any time; changes clear the previous playback automatically.

Download timetable exports the original dataset and the complete final schedule, even when playback is inspecting an earlier step. The result export is an output report; the upload expects the raw dataset object shown above.

## Weekly example

`docs/timetable-seven-days.json` contains a Monday–Sunday schedule from 08:00 to 17:00: six 75-minute classes each day, a morning break from 10:30 to 10:45, lunch from 12:00 to 13:00, and an afternoon break from 15:30 to 15:45. Each of the six subjects appears once daily (seven times weekly). Teacher IDs are placeholders.

The timetable displays days across the top and matching time periods down the left. Class cards show the room and group; the teacher is available in the card tooltip. Full screen expands the calendar; Exit full screen or Escape returns to the study page.
