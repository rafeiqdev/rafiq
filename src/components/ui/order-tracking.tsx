"use client"

import * as React from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * OrderTracking — a vertical status timeline (shadcn/ui style).
 *
 * Ported as-is from the shared registry, with two adaptations for this repo:
 *  1. The Tailwind tokens it relies on (`primary`, `foreground`,
 *     `muted-foreground`) are mapped to the Rafiq navy palette in
 *     tailwind.config.js, so it renders in-brand instead of colorless.
 *  2. `ml-3` → `ms-3` (logical margin) so the label sits on the correct side
 *     in the site's RTL locales (Arabic/Farsi) as well as LTR.
 */
export interface OrderTrackingProps
  extends React.HTMLAttributes<HTMLDivElement> {
  steps: {
    name: string
    timestamp: string
    isCompleted: boolean
  }[]
}

const OrderTracking = React.forwardRef<HTMLDivElement, OrderTrackingProps>(
  ({ steps = [], className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("w-full max-w-md", className)} {...props}>
        {steps.length > 0 ? (
          <div>
            {steps.map((step, index) => (
              <div key={index} className="flex">
                <div className="flex flex-col items-center">
                  {step.isCompleted ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-primary/70" />
                  ) : (
                    <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />
                  )}
                  {index < steps.length - 1 && (
                    <div
                      className={cn("w-[1.5px] grow", {
                        "bg-primary/70": steps[index + 1].isCompleted,
                        "bg-muted-foreground": !steps[index + 1].isCompleted,
                      })}
                    />
                  )}
                </div>
                <div className="ms-3 pb-6">
                  <p className="text-sm font-medium">{step.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {step.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground/80">
            This order has no tracking information.
          </p>
        )}
      </div>
    )
  }
)
OrderTracking.displayName = "OrderTracking"

export { OrderTracking }
