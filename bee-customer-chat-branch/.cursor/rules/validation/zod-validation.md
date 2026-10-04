---
description: "Use Zod for all form validation - create schemas, use safeParse for validation, leverage type inference. Keep validation logic centralized in schemas."
alwaysApply: true
---

# Zod Validation for Forms

**CRITICAL - STRICTLY ENFORCED**: All form validation MUST use **Zod** (`zod`) instead of manual validation functions or inline checks.

## Why Zod

- **TypeScript-first**: Automatic type inference from schemas
- **Type safety**: Types generated from schemas, no manual type definitions
- **Less boilerplate**: Single schema replaces multiple validation functions
- **Auto-transformation**: Built-in data transformation (trim, lowercase, etc.)
- **Better errors**: Clear, consistent error messages
- **Maintainable**: Validation rules centralized in schemas

## Schema Organization

### Location

- **Feature-specific schemas**: `features/[feature]/schemas/validationSchemas.ts`
- **Shared schemas**: `shared/schemas/validationSchemas.ts` (for cross-feature validation)

### Naming Convention

- Schema files: `validationSchemas.ts`
- Schema names: `[formName]Schema` (e.g., `loginSchema`, `registerSchema`)
- Type names: `[FormName]FormData` (e.g., `LoginFormData`, `RegisterFormData`)

## Pattern

### Create Schema

```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address')
    .transform((val) => val.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

// Type inference - no manual types needed!
export type LoginFormData = z.infer<typeof loginSchema>;
```

### Use in Hooks

**Before (manual validation):**
```typescript
const handleSubmit = async () => {
  if (!email.trim()) {
    setError('Email is required');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('Invalid email');
    return;
  }
  // ... more manual checks
};
```

**After (Zod validation):**
```typescript
import { loginSchema, type LoginFormData } from '../schemas/validationSchemas';

const handleSubmit = async () => {
  const validationResult = loginSchema.safeParse({ email, password });
  
  if (!validationResult.success) {
    // Get first error message
    const firstError = validationResult.error.errors[0];
    setError(firstError.message);
    return;
  }
  
  // Validation passed - use transformed data
  const validatedData: LoginFormData = validationResult.data;
  // validatedData.email is already trimmed and lowercased!
};
```

## Common Patterns

### Email Validation

```typescript
email: z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .transform((val) => val.trim().toLowerCase()),
```

### Password Validation

```typescript
password: z
  .string()
  .min(1, 'Password is required')
  .min(8, 'Password must be at least 8 characters')
  .regex(/\d/, 'Password must contain at least one digit')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
  .refine(
    (val) => new Set(val).size >= 4,
    'Password must contain at least 4 unique characters'
  ),
```

### Optional Fields

```typescript
phoneNumber: z
  .string()
  .optional()
  .refine(
    (val) => {
      if (!val || val.trim().length === 0) return true;
      // validation logic
      return isValid;
    },
    { message: 'Error message' }
  )
  .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
```

### String Transformation

```typescript
fullName: z
  .string()
  .min(2, 'Full name must be at least 2 characters')
  .transform((val) => val.trim()),
```

## Error Handling

### Single Error (First Error)

```typescript
const validationResult = schema.safeParse(data);

if (!validationResult.success) {
  const firstError = validationResult.error.errors[0];
  setError(firstError.message);
  return;
}
```

### Multiple Errors (All Errors)

```typescript
if (!validationResult.success) {
  const errors = validationResult.error.errors;
  // errors is an array of all validation errors
  errors.forEach((error) => {
    console.log(`${error.path.join('.')}: ${error.message}`);
  });
}
```

### Field-Specific Errors

```typescript
if (!validationResult.success) {
  const fieldErrors = validationResult.error.flatten().fieldErrors;
  // fieldErrors.email, fieldErrors.password, etc.
  setFieldError('email', fieldErrors.email?.[0]);
  setFieldError('password', fieldErrors.password?.[0]);
}
```

## Integration with TanStack Query

Zod validation works perfectly with TanStack Query mutations:

```typescript
const mutation = useMutation({
  mutationFn: async (payload: RegisterFormData) => {
    // Payload is already validated and transformed
    return authService.register(payload);
  },
});

const handleSubmit = () => {
  const result = registerSchema.safeParse(formData);
  if (!result.success) {
    setError(result.error.errors[0].message);
    return;
  }
  
  // Use validated data
  mutation.mutate(result.data);
};
```

## Schema Reusability

### Extract Common Schemas

```typescript
// shared/schemas/commonSchemas.ts
export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Please enter a valid email address')
  .transform((val) => val.trim().toLowerCase());

// Use in feature schemas
import { emailSchema } from '@/shared/schemas/commonSchemas';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
```

## What NOT to Do

- **Don't** use manual validation functions (`validateEmail`, `validatePassword`, etc.) - use Zod schemas
- **Don't** write inline validation checks - create schemas
- **Don't** manually transform data (trim, lowercase) - use Zod transforms
- **Don't** create manual TypeScript types for form data - use `z.infer<typeof schema>`
- **Don't** duplicate validation logic - extract common schemas

## Migration from Manual Validation

When migrating existing forms:

1. **Create Zod schema** matching current validation rules
2. **Replace manual validation** with `schema.safeParse()`
3. **Use transformed data** from `validationResult.data`
4. **Remove old validation functions** (keep only if used elsewhere)
5. **Update types** to use `z.infer<typeof schema>`

## Example: Complete Form Hook

```typescript
import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { registerSchema, type RegisterFormData } from '../schemas/validationSchemas';
import { authService } from '../services/authService';

export function useRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const registerMutation = useMutation({
    mutationFn: (payload: RegisterFormData) => authService.register(payload),
  });

  const handleRegister = useCallback(() => {
    setValidationError(null);
    
    const result = registerSchema.safeParse({ email, password });
    
    if (!result.success) {
      setValidationError(result.error.errors[0].message);
      return;
    }
    
    registerMutation.mutate(result.data);
  }, [email, password, registerMutation]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    handleRegister,
    isLoading: registerMutation.isPending,
    error: validationError || registerMutation.error?.message || null,
  };
}
```
