import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ScanProgressProps {
  status: "idle" | "scanning" | "success" | "error";
  progress: number;
  message?: string;
}

export function ScanProgress({ status, progress, message }: ScanProgressProps) {
  if (status === "idle") return null;

  return (
    <div className="w-full p-4 rounded-lg border border-border bg-card animate-slide-up">
      <div className="flex items-center gap-3 mb-3">
        {status === "scanning" && (
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
        )}
        {status === "success" && (
          <CheckCircle2 className="h-5 w-5 text-success" />
        )}
        {status === "error" && (
          <AlertCircle className="h-5 w-5 text-destructive" />
        )}
        <span
          className={cn(
            "text-sm font-medium",
            status === "scanning" && "text-primary",
            status === "success" && "text-success",
            status === "error" && "text-destructive"
          )}
        >
          {status === "scanning" && "Scanning receipt..."}
          {status === "success" && "Scan complete!"}
          {status === "error" && "Scan failed"}
        </span>
      </div>
      
      {status === "scanning" && (
        <Progress value={progress} className="h-2" />
      )}
      
      {message && (
        <p className="text-xs text-muted-foreground mt-2">{message}</p>
      )}
    </div>
  );
}
