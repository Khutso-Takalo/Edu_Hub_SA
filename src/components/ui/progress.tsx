import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const PROGRESS_TRANSLATE_CLASSES = [
  "translate-x-[-100%]",
  "translate-x-[-95%]",
  "translate-x-[-90%]",
  "translate-x-[-85%]",
  "translate-x-[-80%]",
  "translate-x-[-75%]",
  "translate-x-[-70%]",
  "translate-x-[-65%]",
  "translate-x-[-60%]",
  "translate-x-[-55%]",
  "translate-x-[-50%]",
  "translate-x-[-45%]",
  "translate-x-[-40%]",
  "translate-x-[-35%]",
  "translate-x-[-30%]",
  "translate-x-[-25%]",
  "translate-x-[-20%]",
  "translate-x-[-15%]",
  "translate-x-[-10%]",
  "translate-x-[-5%]",
  "translate-x-[0%]",
] as const

const getProgressTranslateClass = (value?: number) => {
  const clamped = Math.max(0, Math.min(100, value ?? 0))
  const rounded = Math.round(clamped / 5) * 5
  return PROGRESS_TRANSLATE_CLASSES[Math.floor(rounded / 5)]
}

interface ProgressProps extends
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  variant?: "default" | "success" | "warning" | "error"
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, variant = "default", ...props }, ref) => {
  const translateClass = getProgressTranslateClass(value)

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary/40",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all duration-300 ease-in-out",
          translateClass,
          variant === "default" && "bg-primary",
          variant === "success" && "bg-green-500",
          variant === "warning" && "bg-yellow-500",
          variant === "error" && "bg-destructive",
        )}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
