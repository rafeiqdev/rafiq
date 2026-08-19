import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * InteractiveFolderGallery — a small static "stack of folders" mark for the
 * Document Locker card. Originally ported from a community component with a
 * click-to-open/drag-to-close photo-fan animation; simplified to a plain,
 * non-interactive graphic per feedback — the animation read as gimmicky at
 * dashboard-card scale, and "Manage locker" (the link below it) was already
 * the only real way in, so the folder itself no longer needs to do anything.
 * No RTL handling needed either: the layered-folder mark is symmetric.
 */
export interface InteractiveFolderGalleryProps {
  folderName: string
  className?: string
}

export function InteractiveFolderGallery({ folderName, className }: InteractiveFolderGalleryProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 py-2", className)}>
      <div className="relative h-16 w-20">
        <span className="absolute inset-x-3 bottom-0 top-3 rounded-lg bg-navy/15" />
        <span className="absolute inset-x-1.5 bottom-0 top-1.5 rounded-lg bg-navy/30" />
        <span className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-end overflow-hidden rounded-lg border border-navy/10 bg-gradient-to-b from-navy-light to-navy pb-1.5 shadow-[0_8px_16px_rgba(18,41,77,0.24)]">
          <span className="absolute -top-1.5 start-3 h-2.5 w-9 rounded-t-md bg-navy-light" />
        </span>
      </div>
      <span className="text-xs font-bold text-navy">{folderName}</span>
    </div>
  )
}

export { InteractiveFolderGallery as Component }
