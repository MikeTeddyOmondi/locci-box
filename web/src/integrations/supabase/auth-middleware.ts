// Stub file - Supabase auth middleware removed
// Auth is now handled by web/src/lib/auth.tsx

export function requireSupabaseAuth() {
  // No-op for now - auth handled by AuthProvider
  return async () => {
    return { user: null };
  };
}

// Made with Bob
