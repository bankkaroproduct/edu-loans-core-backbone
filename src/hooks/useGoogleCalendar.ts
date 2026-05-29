import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConnectionRow = {
  user_id: string;
  google_email: string;
  google_name: string | null;
  connected_at: string;
  last_synced_at: string | null;
};

export type GCalEvent = {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  htmlLink?: string;
  status?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

export function useMyGoogleConnection(myUserId: string | undefined) {
  return useQuery({
    queryKey: ["gcal-my-connection", myUserId],
    enabled: !!myUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_google_tokens")
        .select("user_id, google_email, google_name, connected_at, last_synced_at")
        .eq("user_id", myUserId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ConnectionRow | null;
    },
  });
}

export function useTeamGoogleConnections(enabled: boolean) {
  return useQuery({
    queryKey: ["gcal-team-connections"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_google_tokens")
        .select("user_id, google_email, google_name, connected_at, last_synced_at");
      if (error) throw error;
      return (data ?? []) as ConnectionRow[];
    },
  });
}

/** Direct-fetch helper because supabase.functions.invoke doesn't support query strings. */
export async function fetchCalendarEvents(
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<GCalEvent[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const url = new URL(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events`,
  );
  url.searchParams.set("user_id", userId);
  url.searchParams.set("from", fromIso);
  url.searchParams.set("to", toIso);
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${session?.access_token ?? ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  const body = await res.json();
  if (!res.ok) {
    const err = new Error(body?.error ?? "events_fetch_failed");
    (err as Error & { code?: string }).code = body?.error;
    throw err;
  }
  return (body.items ?? []) as GCalEvent[];
}

export function useGoogleCalendarEvents(
  userId: string | undefined,
  fromIso: string,
  toIso: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["gcal-events-v2", userId, fromIso, toIso],
    enabled: enabled && !!userId,
    staleTime: 60_000,
    retry: false,
    queryFn: () => fetchCalendarEvents(userId!, fromIso, toIso),
  });
}

export function useConnectGoogleCalendar() {
  return useMutation({
    mutationFn: async (returnTo: string) => {
      const { data, error } = await supabase.functions.invoke("google-calendar-oauth/initiate", {
        body: { return_to: returnTo },
      });
      if (error) throw error;
      return (data as { authUrl: string }).authUrl;
    },
  });
}

export function useDisconnectGoogleCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (myUserId: string) => {
      const { error } = await supabase
        .from("admin_google_tokens")
        .delete()
        .eq("user_id", myUserId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gcal-my-connection"] });
      qc.invalidateQueries({ queryKey: ["gcal-team-connections"] });
      qc.invalidateQueries({ queryKey: ["gcal-events-v2"] });
    },
  });
}

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      summary: string;
      description?: string;
      start_iso: string;
      end_iso: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "google-calendar-create-event",
        { body: input },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gcal-events-v2"] });
    },
  });
}

export function useRefreshCalendarEvents() {
  const qc = useQueryClient();
  return useCallback(() => {
    qc.invalidateQueries({ queryKey: ["gcal-events-v2"] });
  }, [qc]);
}
