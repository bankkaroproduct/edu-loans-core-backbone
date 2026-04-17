import { Construction } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Card } from "@/components/ui/card";

interface AdminPlaceholderProps {
  title: string;
  description?: string;
}

export default function AdminPlaceholder({ title, description }: AdminPlaceholderProps) {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title={title}
        description={description ?? "This module is part of the Admin Portal foundation. Full functionality ships in upcoming prompts."}
      />
      <Card>
        <EmptyState
          icon={Construction}
          title="Coming soon"
          description="This admin module is registered in the navigation and routing layer. The interactive build will land in the next iteration."
        />
      </Card>
    </div>
  );
}
