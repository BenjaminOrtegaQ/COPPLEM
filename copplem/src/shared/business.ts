import { z } from "zod";


export const BusinessSchema = z.object({
  id: z.number().nullable().optional(),
  nombre: z.string().default(""),
  rut: z.string().nullable().optional(),
  giro: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  comuna: z.string().nullable().optional(),
  ciudad: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  moneda: z.string().nullable().optional(),
  ivaPorDefecto: z.number().nullable().optional(),
  creadoEn: z.string().nullable().optional(),
  actualizadoEn: z.string().nullable().optional(),
});
export type Business = z.infer<typeof BusinessSchema>;


export const BusinessUpdateSchema = BusinessSchema.partial();
export type BusinessUpdate = z.infer<typeof BusinessUpdateSchema>;
