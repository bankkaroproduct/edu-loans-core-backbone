import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Loader2, ExternalLink } from "lucide-react";
import {
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  type ConnectionRow,
} from "@/hooks/useGoogleCalendar";
import { useToast } from "@/hooks/use-toast";

interface Props {
  connection: ConnectionRow | null;
  myUserId: string;
}

export function CalendarConnectCard({ connection, myUserId }: Props) {
  const { toast } = useToast();
  const connect = useConnectGoogleCalendar();
  const disconnect = useDisconnectGoogleCalendar();

  const handleConnect = async () => {
    try {
      const authUrl = await connect.mutateAsync(window.location.origin + "/admin/calendar");
      window.location.href = authUrl;
    } catch (e) {
      toast({
        title: "Could not start connection",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your Google Calendar from this portal?")) return;
    try {
      await disconnect.mutateAsync(myUserId);
      toast({ title: "Google Calendar disconnected" });
    } catch (e) {
      toast({
        title: "Could not disconnect",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Connect Google Calendar
          </CardTitle>
          <CardDescription>
            Link your Google account to view and create calendar events from this portal.
            Only you can see your events; super admins can see the team view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleConnect} disabled={connect.isPending}>
            {connect.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Connect Google Calendar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5" />
          Google Calendar connected
        </CardTitle>
        <CardDescription>
          Connected as <strong>{connection.google_email}</strong>
          {connection.google_name ? ` (${connection.google_name})` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          onClick={handleDisconnect}
          disabled={disconnect.isPending}
        >
          {disconnect.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Disconnect
        </Button>
      </CardContent>
    </Card>
  );
}
