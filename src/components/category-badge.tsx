"use client"

import { cn } from "@/lib/utils"
import type { Category } from "@/lib/types"

interface CategoryBadgeProps {
  category: Category
  onRemove?: () => void
  className?: string
}

export function CategoryBadge({ category, onRemove, className }: CategoryBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[180px] items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        className
      )}
      style={{
        borderColor: category.color,
        color: category.color,
        backgroundColor: `${category.color}14`,
      }}
      title={category.name}
    >
      <span className="truncate">{category.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Kategorie ${category.name} entfernen`}
          className="ml-0.5 rounded-sm opacity-70 transition-opacity hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}
    </span>
  )
}
