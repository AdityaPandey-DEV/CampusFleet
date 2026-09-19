"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type React from "react";
import { Search, Check, ChevronDown, X, User } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  avatar?: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string, option?: DropdownOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  /** Show avatar circles next to each option */
  showAvatars?: boolean;
}

/**
 * Reusable SearchableDropdown — a popover-style dropdown with live search filter.
 * Used in: Class Create (Assign Teacher), Add Timetable Slot (Assign Teacher),
 * Allocate Teacher to Class, and any other admin form needing a searchable picker.
 */
export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  searchPlaceholder = "Search...",
  label,
  required = false,
  disabled = false,
  clearable = true,
  className = "",
  showAvatars = true,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filtered = options.filter((o) => {
    const q = searchQuery.toLowerCase();
    return (
      o.label.toLowerCase().includes(q) ||
      (o.sublabel?.toLowerCase().includes(q) ?? false)
    );
  });

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = useCallback(
    (option: DropdownOption) => {
      onChange(option.value, option);
      setIsOpen(false);
      setSearchQuery("");
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("", undefined);
    },
    [onChange]
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  const avatarColors = [
    "bg-blue-500", "bg-green-500", "bg-pink-500", "bg-yellow-500",
    "bg-red-500", "bg-green-500", "bg-blue-500", "bg-orange-500",
  ];

  const getColor = (name: string) =>
    avatarColors[name.charCodeAt(0) % avatarColors.length];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2 text-xs rounded-xl border transition-all
          ${disabled
            ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer"
          }
          ${isOpen ? "border-blue-500 ring-2 ring-blue-500/20" : ""}
        `}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedOption ? (
            <>
              {showAvatars && (
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0 ${getColor(selectedOption.label)}`}
                >
                  {getInitials(selectedOption.label)}
                </div>
              )}
              <div className="truncate text-left">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {selectedOption.label}
                </span>
                {selectedOption.sublabel && (
                  <span className="ml-1.5 text-gray-400 font-normal">
                    · {selectedOption.sublabel}
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="text-gray-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {clearable && value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl shadow-black/20 overflow-hidden animate-in fade-in slide-in-bg-top-1 duration-150">
          {/* Search Bar */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                {searchQuery ? `No results for "${searchQuery}"` : "No options available"}
              </div>
            ) : (
              filtered.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-left transition-colors
                      ${isSelected
                        ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-200"
                      }
                    `}
                  >
                    {showAvatars ? (
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 ${getColor(option.label)}`}
                      >
                        {getInitials(option.label)}
                      </div>
                    ) : (
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{option.label}</div>
                      {option.sublabel && (
                        <div className="text-[10px] text-gray-400 truncate mt-0.5">
                          {option.sublabel}
                        </div>
                      )}
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
