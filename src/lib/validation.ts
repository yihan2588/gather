import { z } from "zod";
const id = z.uuid();
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "Enter a valid calendar date");
const kind = z.enum(["completed", "student_absent", "tutor_absent", "holiday"]);
const base = {
  occurred_on: calendarDate,
  kind,
  duration_minutes: z.coerce.number().int().min(0).max(1440),
};
export const createAttendance = z
  .object({ ...base, assignment_id: id, request_id: id })
  .refine(
    (p) =>
      p.kind === "completed"
        ? p.duration_minutes > 0
        : p.duration_minutes === 0,
    {
      message: "Completed sessions need positive minutes; absences need zero.",
      path: ["duration_minutes"],
    },
  );
export const editAttendance = z.union([
  z.object({
    id,
    expected_version: z.coerce.number().int().positive(),
    void_reason: z.string().trim().min(1).max(300),
  }),
  z.object({
    ...base,
    id,
    expected_version: z.coerce.number().int().positive(),
  }),
]);
export const schemas = {
  create_attendance: createAttendance,
  edit_attendance: editAttendance,
  save_student: z.object({
    id: id.optional(),
    display_name: z.string().trim().min(1).max(120),
  }),
  set_membership: z.object({
    user_id: id,
    status: z.enum(["active", "disabled", "pending"]),
  }),
  save_assignment: z.object({
    id: id.optional(),
    expected_version: z.coerce.number().int().positive().optional(),
    tutor_id: id.optional(),
    student_id: id.optional(),
    term_id: id.optional(),
    starts_on: calendarDate,
    ends_on: z.union([calendarDate, z.literal("")]).optional(),
    end_reason: z.string().max(300).optional(),
    site: z.string().max(200).optional(),
    usual_days: z.string().max(200).optional(),
    usual_times: z.string().max(200).optional(),
  }),
  save_achievement: z.union([
    z.object({
      id,
      expected_version: z.coerce.number().int().positive(),
      void_reason: z.string().trim().min(1).max(300),
    }),
    z.object({
      id: id.optional(),
      expected_version: z.coerce.number().int().positive().optional(),
      student_id: id.optional(),
      term_id: id.optional(),
      goal_type_id: z.string().max(20).optional(),
      custom_label: z.string().max(200).optional(),
      attained_on: calendarDate,
    }),
  ]),
};
export type Operation = keyof typeof schemas;
export const reportFilter = z.object({
  term_id: id,
  month: calendarDate,
  tutor_id: z.union([id, z.literal("")]).optional(),
  student_id: z.union([id, z.literal("")]).optional(),
});
