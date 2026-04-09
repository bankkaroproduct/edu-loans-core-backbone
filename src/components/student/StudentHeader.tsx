import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Menu, X } from "lucide-react";
import { useState } from "react";

export function StudentHeader() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLanding = location.pathname === "/student";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <Link to="/student" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold leading-tight tracking-tight text-foreground">EduLoans</span>
            <span className="text-[10px] leading-none text-muted-foreground">by CashKaro</span>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {isLanding && (
            <>
              <a href="#how-it-works" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                How It Works
              </a>
              <a href="#faq" className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                FAQs
              </a>
            </>
          )}
          <Link to="/student/login">
            <Button variant="ghost" size="sm" className="text-sm">Resume Application</Button>
          </Link>
          <Link to="/student/login">
            <Button size="sm" className="text-sm">Start My Journey</Button>
          </Link>
        </nav>

        {/* Mobile toggle */}
        <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t bg-background px-4 pb-4 pt-2 md:hidden">
          <div className="flex flex-col gap-2">
            {isLanding && (
              <>
                <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">How It Works</a>
                <a href="#faq" onClick={() => setMobileOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground">FAQs</a>
              </>
            )}
            <Link to="/student/login" onClick={() => setMobileOpen(false)}>
              <Button variant="outline" size="sm" className="w-full">Resume Application</Button>
            </Link>
            <Link to="/student/login" onClick={() => setMobileOpen(false)}>
              <Button size="sm" className="w-full">Start My Journey</Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
