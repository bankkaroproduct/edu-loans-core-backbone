import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type Notification = Tables<"notifications_queue">;

const TYPE_LABELS: Record<string, string> = {
  lead_created: "Lead Created",
  lead_updated: "Lead Updated",
  stage_changed: "Stage Changed",
  document_uploaded: "Document Uploaded",
  document_verified: "Document Verified",
  document_rejected: "Document Rejected",
  payout_triggered: "Payout Triggered",
  payout_approved: "Payout Approved",
  payout_paid: "Payout Paid",
  bulk_upload_completed: "Bulk Upload Done",
  system_alert: "System Alert",
};

export function NotificationBell() {
  const { appUser } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = items.filter((n) => n.delivery_status !== "read").length;

  const fetchItems = async () => {
    if (!appUser?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications_queue")
      .select("*")
      .eq("recipient_user_id", appUser.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
    if (!appUser?.id) return;
    const channel = supabase
      .channel(`notif-${appUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications_queue",
          filter: `recipient_user_id=eq.${appUser.id}`,
        },
        () => fetchItems()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id]);

  const markAllRead = async () => {
    if (!appUser?.id || unreadCount === 0) return;
    const ids = items.filter((n) => n.delivery_status !== "read").map((n) => n.id);
    if (ids.length === 0) return;
    await supabase
      .from("notifications_queue")
      .update({ delivery_status: "read" })
      .in("id", ids);
    setItems((prev) => prev.map((n) => ({ ...n, delivery_status: "read" })));
  };

  const handleClick = async (n: Notification) => {
    if (n.delivery_status !== "read") {
      await supabase
        .from("notifications_queue")
        .update({ delivery_status: "read" })
        .eq("id", n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, delivery_status: "read" } : x))
      );
    }
    if (n.entity_type === "lead" && n.entity_id) {
      navigate(`/leads/${n.entity_id}`);
      setOpen(false);
    } else if (n.entity_type === "batch" && n.entity_id) {
      navigate(`/bulk-upload`);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {loading ? (
            <p className="text-sm text-muted-foreground p-6 text-center">Loading…</p>
          ) : items.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll be notified about lead updates and admin remarks here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const isUnread = n.delivery_status !== "read";
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors space-y-1",
                        isUnread && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={isUnread ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {TYPE_LABELS[n.notification_type] ?? n.notification_type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {n.message_body && (
                        <p className={cn("text-xs", isUnread ? "text-foreground" : "text-muted-foreground")}>
                          {n.message_body}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
