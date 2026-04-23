export type CommChannel = "email" | "whatsapp";
export type CommMode = "mock" | "demo_live";
export type CommProvider = "mock" | "resend" | "twilio_sandbox";
export type CommStatus = "simulated" | "sent" | "failed";

export interface CommunicationTemplate {
  id: string;
  template_key: string;
  channel: CommChannel;
  subject: string | null;
  body: string;
  description: string | null;
  active_flag: boolean;
}

export interface CommunicationLog {
  id: string;
  channel: CommChannel;
  provider: CommProvider;
  template_key: string;
  recipient: string;
  lead_id: string | null;
  payload_snapshot: {
    subject?: string | null;
    body?: string;
    variables?: Record<string, unknown>;
    template?: { key: string; channel: CommChannel };
  };
  mode_used: CommMode;
  send_status: CommStatus;
  provider_message_id: string | null;
  error_message: string | null;
  triggered_by_user: string | null;
  created_at: string;
}
