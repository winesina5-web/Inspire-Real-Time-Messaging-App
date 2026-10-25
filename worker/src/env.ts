export interface Env {
  AI?: { run(model: string, input: any): Promise<any> };
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  ALLOWED_ORIGINS?: string;
  TURNSTILE_SECRET_KEY?: string;
  BOT_RELAY_INTERNAL_SECRET?: string;
  TURN_KEY_ID?: string;
  TURN_API_TOKEN?: string;
}
