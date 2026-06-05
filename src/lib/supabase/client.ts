import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes del lado del navegador ("use client").
 * Usa la anon key pública; la seguridad real vive en las RLS policies de Supabase.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
