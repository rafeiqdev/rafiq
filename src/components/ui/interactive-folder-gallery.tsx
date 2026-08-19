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
 *  2. Fans out small document chips (icon only, no photo/name) instead of
 *     `<img>` photos — the source data is uploaded documents (no thumbnail),
 *     and keeping each chip icon-only is what lets the whole thing stay small;
 *     the real per-document list still lives behind "Manage locker".
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
    <div className={cn("relative w-full select-none py-1.5", className)}>
      <div className="relative mx-auto flex h-[104px] w-full max-w-[190px] flex-col items-center justify-end">
        {isOpen && (
          <button
            type="button"
            aria-label={folderName}
            onClick={() => setIsOpen(false)}
            className="absolute inset-0 z-0 cursor-default"
          />
        )}

        {/* fanned document chips */}
        <div className="absolute bottom-5 z-10 flex justify-center">
          {items.map((doc, i) => {
            const mid = (items.length - 1) / 2
            const offset = i - mid

            const stackY = offset * -2.5
            const stackX = offset * 2 * dir
            const stackRotate = offset * 4 * dir
            const stackScale = 1 - Math.abs(offset) * 0.03

            const openY = -46
            const openX = offset * 34 * dir

            return (
              <motion.div
                key={doc.id}
                drag={isOpen}
                dragSnapToOrigin
                onDragEnd={(_e, info) => {
                  if (info.offset.y > 50 && isOpen) setIsOpen(false)
                }}
                aria-label={doc.name}
                title={doc.name}
                className={cn(
                  "absolute bottom-0 flex h-11 w-8 origin-bottom items-center justify-center overflow-hidden rounded-md border border-navy/10 bg-white shadow-[0_6px_12px_rgba(18,41,77,0.16)]",
                  isOpen ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none"
                )}
                animate={
                  !isOpen
                    ? { y: stackY, x: stackX, rotate: stackRotate, scale: stackScale, zIndex: i + 10 }
                    : { y: openY, x: openX, rotate: 0, scale: 1.05, zIndex: 50 }
                }
                whileHover={isOpen ? { scale: 1.15, zIndex: 100 } : {}}
                whileDrag={isOpen ? { scale: 1.2, zIndex: 150 } : {}}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
              >
                <FileText className="h-3.5 w-3.5 text-navy" />
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
            "relative z-20 w-full max-w-[140px]",
            isOpen ? "pointer-events-none" : "cursor-pointer"
          )}
          style={{ transformOrigin: "bottom" }}
        >
          <span className="absolute -top-2 start-3 h-3 w-10 rounded-t-md bg-navy-light" />
          <span className="flex h-12 w-full flex-col items-center justify-end rounded-lg rounded-ss-none border border-navy/10 bg-gradient-to-b from-navy-light to-navy pb-1.5 shadow-[0_8px_16px_rgba(18,41,77,0.24)]">
            <span className="rounded bg-cream px-2 py-0.5">
              <span className="text-[11px] font-bold text-navy">{folderName}</span>
            </span>
          </span>
        </motion.button>
      </div>

      <motion.p
        animate={{ opacity: isOpen ? 1 : 0, y: isOpen ? 0 : 10 }}
        className="pointer-events-none mt-1 text-center text-[9px] font-semibold uppercase tracking-widest text-navy/40"
      >
        {dragHintText}
      </motion.p>
    </div>
  )
}

export { InteractiveFolderGallery as Component }
