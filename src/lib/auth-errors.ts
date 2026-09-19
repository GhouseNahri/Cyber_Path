/** Maps Supabase/auth errors to friendly, non-leaky user messages.
 *  Never show raw provider errors; never reveal whether an email exists. */

export function friendlyAuthError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();

    if (msg.includes("invalid login credentials")) {
      return "Incorrect email or password. Try again, or reset your password.";
    }
    if (msg.includes("email not confirmed")) {
      return "Please confirm your email first — check your inbox for the confirmation link.";
    }
    if (msg.includes("user already registered") || msg.includes("already been registered")) {
      return "An account with this email already exists. Try signing in instead.";
    }
    if (msg.includes("password should be at least") || msg.includes("password must be")) {
      return "Password is too short — use at least 8 characters.";
    }
    if (
      msg.includes("email_address_invalid") ||
      (msg.includes("email") && msg.includes("invalid"))
    ) {
      return "That email was rejected — check for typos. Placeholder inboxes like example.com are blocked; use an address you can access.";
    }
    if (msg.includes("unable to validate email") || msg.includes("invalid email")) {
      return "That email address doesn't look right. Check for typos.";
    }
    if (msg.includes("rate limit") || msg.includes("too many requests")) {
      return "Too many attempts — wait a minute and try again.";
    }
    if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed")) {
      return "Can't reach the server. Check your connection and try again.";
    }
    if (
      msg.includes("failed to parse url") ||
      msg.includes("supabaseurl is required") ||
      msg.includes("supabase key is required")
    ) {
      return "The app isn't connected to its backend yet. (Developer: set the Supabase env vars and restart the dev server.)";
    }
    if (msg.includes("session expired")) {
      return e.message;
    }
    if (msg.includes("supabase is not configured")) {
      return "The app isn't connected to its backend yet. (Developer: set the Supabase env vars.)";
    }
    if (msg.includes("duplicate key") && msg.includes("username")) {
      return "That username is taken — try another.";
    }
    if (msg.includes("database") || msg.includes("schema")) {
      return "The database isn't set up yet. Run the Phase 2 SQL migration in Supabase and try again.";
    }
  }
  return "Something went wrong. Please try again in a moment.";
}
