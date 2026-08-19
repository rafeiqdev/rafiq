"use client"

import * as React from "react"
import { useState } from "react"
import { motion } from "framer-motion"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * InteractiveFolderGallery — ported from a community "photo folder" registry
 * component, adapted for this repo:
 *  1. Repainted from the original dark/near-black chrome to the Rafiq navy +
 *     cream palette (tailwind.config.js), and simplified from a 3-state
 *     hover/open/drag interaction down to 2 (closed → open, drag-down to
 *     close) — this sits inside a compact dashboard card, not a full-page hero.
 *  2. Fans out document cards (icon + filename) instead of `<img>` photos —
 *     the source data is uploaded documents, which have no thumbnail.
 *  3. `bg-linear-to-*` (Tailwind v4) → `bg-gradient-to-*` (this repo is on v3).
 *  4. Fan-out is computed with framer-motion `x`/`rotate` transforms, which —
 *     unlike CSS logical properties — do not auto-flip for RTL. The `rtl`
 *     prop mirrors those offsets so the stack fans toward the reading
 *     direction in Arabic/Farsi instead of always toward the LTR side.
 */
export interface FolderGalleryDocument {
  id: string | number
  name: string
}

export interface InteractiveFolderGalleryProps {
  documents: FolderGalleryDocument[]
  folderName: string
  dragHintText: string
  rtl?: boolean
  className?: string
}

export function InteractiveFolderGallery({
  documents,
  folderName,
  dragHintText,
  rtl = false,
  className,
}: InteractiveFolderGalleryProps) {
  const [isOpen, setIsOpen] = useState(false)
  const items = documents.slice(0, 5)
  const dir = rtl ? -1 : 1

  if (items.length === 0) return null

  return (
    <div className={cn("relative w-full select-none py-6", className)}>
      <div className="relative mx-auto flex h-[220px] w-full max-w-[320px] flex-col items-center justify-end">
        {isOpen && (
          <button
            type="button"
            aria-label={folderName}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 z-0 cursor-default"
          />
        )}

        {/* fanned document cards */}
        <div className="absolute bottom-8 z-10 flex justify-center">
          {items.map((doc, i) => {
            const mid = (items.length - 1) / 2
            const offset = i - mid

            const stackY = offset * -4
            const stackX = offset * 3 * dir
            const stackRotate = offset * 3 * dir
            const stackScale = 1 - Math.abs(offset) * 0.03

            const openY = -84
            const openX = offset * 70 * dir

            return (
              <motion.div
                key={doc.id}
                drag={isOpen}
                dragSnapToOrigin
                onDragEnd={(_e, info) => {
                  if (info.offset.y > 80 && isOpen) setIsOpen(false)
                }}
                className={cn(
                  "absolute bottom-0 flex h-32 w-24 origin-bottom flex-col items-center justify-start gap-2 overflow-hidden rounded-lg border border-navy/10 bg-white p-2.5 shadow-[0_10px_20px_rgba(18,41,77,0.18)]",
                  isOpen ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none"
                )}
                animate={
                  !isOpen
                    ? { y: stackY, x: stackX, rotate: stackRotate, scale: stackScale, zIndex: i + 10 }
                    : { y: openY, x: openX, rotate: 0, scale: 1.02, zIndex: 50 }
                }
                whileHover={isOpen ? { scale: 1.08, zIndex: 100 } : {}}
                whileDrag={isOpen ? { scale: 1.12, zIndex: 150 } : {}}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-blue text-navy">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <span className="line-clamp-3 text-center text-[10.5px] font-semibold leading-tight text-navy">
                  {doc.name}
                </span>
              </motion.div>
            )
          })}
        </div>

        {/* closed folder */}
        <motion.button
          type="button"
          onClick={() => setIsOpen(true)}
          animate={{ opacity: isOpen ? 0 : 1 }}
          className={cn(
            "relative z-20 w-full max-w-[220px]",
            isOpen ? "pointer-events-none" : "cursor-pointer"
          )}
          style={{ transformOrigin: "bottom" }}
        >
          <span className="absolute -top-3 start-5 h-5 w-16 rounded-t-lg bg-navy-light" />
          <span className="flex h-24 w-full flex-col items-center justify-end rounded-xl rounded-ss-none border border-navy/10 bg-gradient-to-b from-navy-light to-navy pb-4 shadow-[0_14px_26px_rgba(18,41,77,0.28)]">
            <span className="rounded-lg bg-cream px-4 py-2 shadow-inner">
              <span className="text-sm font-bold text-navy">{folderName}</span>
            </span>
          </span>
        </motion.button>
      </div>

      <motion.p
        animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 16 }}
        className="pointer-events-none mt-2 text-center text-[11px] font-semibold uppercase tracking-widest text-navy/40"
      >
        {dragHintText}
      </motion.p>
    </div>
  )
}

export { InteractiveFolderGallery as Component }
