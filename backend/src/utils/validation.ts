import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  type: z.enum(["CLINIC", "OFFICE"]),
});

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  organizationId: z.string().uuid("Invalid organization ID"),
  slotDuration: z.number().int().min(1, "Slot duration must be at least 1 minute"),
  maxAppointments: z.number().int().min(1, "Max appointments must be at least 1"),
});

export const appointmentSchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().uuid("Invalid organization ID"),
  departmentId: z.string().uuid("Invalid department ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  timeSlot: z.string().min(1, "Time slot is required"),
  patientName: z.string().optional(),
  patientPhone: z.string().optional(),
  isEmergency: z.boolean().optional(),
});

export const emergencyAppointmentSchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().uuid("Invalid organization ID"),
  departmentId: z.string().uuid("Invalid department ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  timeSlot: z.string().min(1, "Time slot is required"),
  patientName: z.string().optional(),
  patientPhone: z.string().optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(["USER", "STAFF", "ADMIN"]),
});

// Staff Management Schemas
export const createStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  organizationId: z.string().uuid("Invalid organization ID"),
  departmentId: z.string().uuid("Invalid department ID").optional(),
  position: z.string().optional(),
});

export const updateStaffSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().email("Invalid email address").optional(),
  organizationId: z.string().uuid("Invalid organization ID").optional(),
  departmentId: z.string().uuid("Invalid department ID").optional().nullable(),
  position: z.string().optional(),
});

export const assignDepartmentSchema = z.object({
  departmentId: z.string().uuid("Invalid department ID").nullable(),
});

// Staff Appointment Management Schemas
export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["SERVING", "COMPLETED", "NO_SHOW"]),
});

export const queueFilterSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  departmentId: z.string().uuid("Invalid department ID").optional(),
});

