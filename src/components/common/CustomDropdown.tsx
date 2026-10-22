"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export type DropdownOption = 
  | string 
  | number 
  | { 
      value: string | number; 
      label: string; 
      sublabel?: string; 
      disabled?: boolean 
    };

export interface CustomDropdownProps {
  options: DropdownOption[];
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  buttonClassName?: string;
  menuClassName?: string;
  size?: "sm" | "md" | "lg";
  id?: string;
  name?: string;
}

export function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  containerClassName = "",
  buttonClassName = "",
  menuClassName = "",
  size = "md",
  id,
  name,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const strValue = String(value ?? "");

  const selectedOption = options.find((opt) => {
    if (typeof opt === "string" || typeof opt === "number") {
      return String(opt) === strValue;
    }
    return String(opt.value) === strValue;
  });

  const displayLabel = selectedOption
    ? typeof selectedOption === "string" || typeof selectedOption === "number"
      ? String(selectedOption)
      : selectedOption.label
    : "";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-4 py-2.5 text-sm",
  }[size];

  return (
    <div ref={containerRef} className={`relative ${containerClassName || "w-full"} ${className}`}>
      {/* Hidden input to support form serialization if name is provided */}
      {name && <input type="hidden" name={name} value={strValue} id={id} />}

      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-none focus:outline-none focus:border-green-500 flex justify-between items-center transition-all ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/40"
            : "hover:border-gray-400 dark:hover:border-gray-600 cursor-pointer"
        } ${sizeClasses} ${buttonClassName}`}
      >
        <span
          className={`truncate ${
            displayLabel
              ? "text-gray-900 dark:text-white font-medium"
              : "text-gray-400 dark:text-gray-500 font-normal"
          }`}
        >
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-green-600" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div
          className={`absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-none shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/50 ${menuClassName}`}
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 italic">
              No options available
            </div>
          ) : (
            options.map((opt, idx) => {
              const optVal = typeof opt === "string" || typeof opt === "number" ? String(opt) : String(opt.value);
              const optLabel = typeof opt === "string" || typeof opt === "number" ? String(opt) : opt.label;
              const optSub = typeof opt === "string" || typeof opt === "number" ? undefined : opt.sublabel;
              const optDisabled = typeof opt === "object" ? opt.disabled : false;
              const isSelected = strValue === optVal;

              return (
                <button
                  key={`${optVal}-${idx}`}
                  type="button"
                  disabled={optDisabled}
                  onClick={() => {
                    if (!optDisabled) {
                      onChange(optVal);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full text-left px-3.5 py-2 text-xs md:text-sm transition-colors flex items-center justify-between ${
                    optDisabled
                      ? "opacity-40 cursor-not-allowed bg-gray-50 dark:bg-gray-950/20"
                      : isSelected
                      ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 font-medium"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{optLabel}</span>
                    {optSub && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                        {optSub}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0 ml-1" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
export default CustomDropdown;
