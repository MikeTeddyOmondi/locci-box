// Stub file - Supabase auth attacher removed
// Auth is now handled by web/src/lib/auth.tsx

export function attachSupabaseAuth() {
  // No-op middleware - auth handled by AuthProvider
  return async (ctx: unknown, next: () => Promise<void>) => {
    await next();
  };
}

// Made with Bob
