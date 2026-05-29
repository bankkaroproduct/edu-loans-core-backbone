import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import { useMyGoogleConnection } from "@/hooks/useGoogleCalendar";
import { CalendarConnectCard } from "@/components/admin/calendar/CalendarConnectCard";
import { MyCalendarView } from "@/components/admin/calendar/MyCalendarView";
import { TeamCalendarView } from "@/components/admin/calendar/TeamCalendarView";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function AdminCalendar() {
  const { appUser } = useAuth();
  const { isSuperAdmin, canEdit } = useAdminPermissions();
  const { data: connection, isLoading } = useMyGoogleConnection(appUser?.id);
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("calendar_connected")) {
      toast({ title: "Google Calendar connected" });
      params.delete("calendar_connected");
      setParams(params, { replace: true });
    }
    const err = params.get("calendar_error");
    if (err) {
      toast({
        title: "Calendar connection failed",
        description: err,
        variant: "destructive",
      });
      params.delete("calendar_error");
      setParams(params, { replace: true });
    }
  }, [params, setParams, toast]);

  if (!appUser) return null;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          {isSuperAdmin
            ? "View your calendar and the combined team calendar."
            : "View your Google Calendar and block time without leaving the portal."}
        </p>
      </div>

      {isSuperAdmin ? (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">My Calendar</TabsTrigger>
            <TabsTrigger value="team">Team Calendar</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="mt-4 space-y-6">
            {isLoading ? null : connection ? (
              <>
                <CalendarConnectCard connection={connection} myUserId={appUser.id} />
                <MyCalendarView userId={appUser.id} canCreate={canEdit("calendar")} />
              </>
            ) : (
              <CalendarConnectCard connection={null} myUserId={appUser.id} />
            )}
          </TabsContent>
          <TabsContent value="team" className="mt-4">
            <TeamCalendarView />
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <CalendarConnectCard connection={connection ?? null} myUserId={appUser.id} />
          {isLoading ? null : connection ? (
            <MyCalendarView userId={appUser.id} canCreate={canEdit("calendar")} />
          ) : null}
        </>
      )}
    </div>
  );
}
