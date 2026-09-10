import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Klassischer Form-POST → /login/submit (Route-Handler).
 * Bewusst kein Server-Action-Form: zuverlässiger hinter Caddy/Reverse-Proxy
 * und ohne JS-Interception klickbar.
 */
export function LoginForm({ error }: { error?: string | null }) {
  return (
    <form action="/login/submit" method="post" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit">Anmelden</Button>
    </form>
  );
}
