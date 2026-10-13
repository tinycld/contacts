import { z } from '@tinycld/core/ui/form'

export const contactSchema = z.object({
    first_name: z.string().trim().min(1, 'First name is required'),
    last_name: z.string().trim(),
    email: z
        .string()
        .trim()
        .pipe(z.literal('').or(z.email('Invalid email address'))),
    phone: z.string().trim(),
    company: z.string().trim(),
    job_title: z.string().trim(),
    notes: z.string().trim(),
})

export type ContactFormValues = z.infer<typeof contactSchema>
