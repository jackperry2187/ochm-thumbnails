"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
// import { CircleIcon } from "lucide-react" // We'll create a custom indicator

import { cn } from "~/lib/utils"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-4 shrink-0 rounded-full border-2 border-indigo-400/70 text-indigo-500 shadow-sm",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500 data-[state=checked]:text-slate-50",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center h-full w-full"
      >
        {/* Custom indicator: a smaller, centered, filled circle when checked */}
        {/* This div will only be visible due to parent's data-[state=checked] styles changing text color to slate-50 */}
        <div className="h-1.5 w-1.5 rounded-full bg-current" /> 
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
