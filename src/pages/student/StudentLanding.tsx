import { StudentHeader } from "@/components/student/StudentHeader";
import { StudentFooter } from "@/components/student/StudentFooter";

export default function StudentLanding() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StudentHeader />
      <main className="flex-1 p-6">
        <h1 className="text-4xl font-bold text-foreground">Student Landing — Diagnostic 2 (Header+Footer)</h1>
      </main>
      <StudentFooter />
    </div>
  );
}
