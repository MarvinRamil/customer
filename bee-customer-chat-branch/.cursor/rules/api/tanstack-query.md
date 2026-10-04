---
description: "Use TanStack Query (React Query) for all API data fetching - useQuery for GET requests, useMutation for POST/PUT/PATCH/DELETE. Keep apiClient for request logic."
alwaysApply: true
---

# TanStack Query for API Calls

**CRITICAL - STRICTLY ENFORCED**: All API data fetching MUST use **TanStack Query** (`@tanstack/react-query`) instead of manual `useState`/`useEffect` patterns.

## When to Use

- **`useQuery`** – For GET requests (fetching data)
- **`useMutation`** – For POST, PUT, PATCH, DELETE requests (creating/updating/deleting data)

## Architecture

- **Keep `apiClient`** – Your existing `apiClient` handles auth tokens, error transformation, base URL. Don't replace it.
- **Keep services** – Services (`authService`, `bookingService`, etc.) wrap `apiClient` calls. Use them in TanStack Query hooks.
- **Use TanStack Query hooks** – Wrap service calls with `useQuery`/`useMutation` in feature hooks.

## Pattern

### GET Requests (useQuery)

**Before (manual state):**
```typescript
const [data, setData] = useState([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  fetchData();
}, []);

const fetchData = async () => {
  setIsLoading(true);
  try {
    const result = await service.getData();
    setData(result);
  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};
```

**After (TanStack Query):**
```typescript
import { useQuery } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';

export function useBookings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingService.getBookings(),
  });

  return {
    bookings: data || [],
    isLoading,
    error: error?.message || null,
    refresh: refetch,
  };
}
```

### POST/PUT/PATCH/DELETE (useMutation)

**Before (manual state):**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState(null);

const handleSubmit = async (payload) => {
  setIsSubmitting(true);
  setError(null);
  try {
    await service.create(payload);
    // success
  } catch (err) {
    setError(err.message);
  } finally {
    setIsSubmitting(false);
  }
};
```

**After (TanStack Query):**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';

export function useCreateBooking() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: CreateBookingRequest) => 
      bookingService.createBooking(payload),
    onSuccess: () => {
      // Invalidate and refetch bookings list
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  return {
    createBooking: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error?.message || null,
  };
}
```

## Query Keys

Use consistent, hierarchical query keys:

- `['bookings']` – All bookings
- `['bookings', id]` – Single booking
- `['bookings', 'stats']` – Booking statistics
- `['auth', 'user']` – Current user
- `['profile']` – User profile

## Benefits

- **Automatic caching** – Data is cached and reused across components
- **Background refetching** – Stale data refetches automatically
- **Deduplication** – Multiple components requesting same data = one request
- **Less boilerplate** – No manual `useState`/`useEffect`/error handling
- **Optimistic updates** – Easy to implement optimistic UI

## Migration

When creating new hooks or refactoring existing ones:

1. Replace `useState` + `useEffect` with `useQuery` for GET requests
2. Replace manual submit handlers with `useMutation` for POST/PUT/PATCH/DELETE
3. Use `queryClient.invalidateQueries()` to refresh related data after mutations
4. Keep your existing `apiClient` and services – they work perfectly with TanStack Query

## Example: Complete Hook

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';
import type { Booking } from '../types';

export function useBookings() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['bookings'],
    queryFn: () => bookingService.getBookings(),
  });

  return {
    bookings: data || [],
    isLoading,
    error: error?.message || null,
    refresh: refetch,
  };
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBookingRequest }) =>
      bookingService.updateBooking(id, payload),
    onSuccess: (_, variables) => {
      // Invalidate specific booking and list
      queryClient.invalidateQueries({ queryKey: ['bookings', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}
```

## Hook Organization: When to Separate vs Combine

### Separate TanStack Query Hooks (Recommended for Queries)

**Separate if:**
- Used in multiple places/components
- You want to test it independently
- It's a reusable data fetching hook (GET requests)
- The query logic is complex and deserves its own file

**Example - Separate Query Hook:**
```typescript
// features/auth/hooks/useCheckEmail.ts
export function useCheckEmail(email: string) {
  return useQuery({
    queryKey: ['auth', 'checkEmail', email],
    queryFn: () => authService.checkEmail(email),
  });
}

// Used in multiple places:
// - Registration form
// - Profile update form
// - Email change form
```

### Combine TanStack Query with Business Logic (For Mutations)

**Combine if:**
- Only used in one place
- Tightly coupled to form state/validation
- The mutation is part of a larger form workflow
- It's a POST/PUT/DELETE that's form-specific

**Example - Combined Mutation Hook:**
```typescript
// features/auth/hooks/useRegister.ts
export function useRegister() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Mutation combined with form state
  const registerMutation = useMutation({
    mutationFn: (payload) => authService.register(payload),
  });
  
  // Form validation, handlers, etc.
  return { email, setEmail, handleRegister, ... };
}
```

### Rule of Thumb

- **Queries (GET)**: Usually separate hooks – they're reusable data fetchers
- **Mutations (POST/PUT/DELETE)**: Can be separate OR combined with form logic
  - Separate if: Reusable across multiple forms
  - Combine if: Form-specific, tightly coupled to form state

## What NOT to Do

- **Don't** replace `apiClient` – it handles auth, errors, base URL correctly
- **Don't** use manual `useState`/`useEffect` for API calls – use TanStack Query
- **Don't** create duplicate query keys – use consistent naming
- **Don't** forget to invalidate queries after mutations that change data
- **Don't** inline `useQuery`/`useMutation` directly in components – extract to hooks
