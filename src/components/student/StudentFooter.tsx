import { GraduationCap } from "lucide-react";

export function StudentFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">EduLoans</span>
              <span className="ml-1 text-xs text-muted-foreground">by CashKaro</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#" className="transition-colors hover:text-foreground">Privacy Policy</a>
            <a href="#" className="transition-colors hover:text-foreground">Terms of Service</a>
            <a href="#" className="transition-colors hover:text-foreground">Help Center</a>
          </div>
        </div>
        <div className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} EduLoans by CashKaro. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
