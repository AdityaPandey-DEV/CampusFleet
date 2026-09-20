# CampusFleet Design System & Standards

## 1. Core Philosophy
CampusFleet aims to deliver a **professional, simple, and premium** user experience using the latest web design standards. Our interfaces should feel native, snappy, and deeply empathetic to the stress of daily campus commuting. 

### Key Principles
- **Clarity over Density:** Do not overcrowd the screen. Guide the user naturally.
- **Dynamic & Alive:** Interfaces should respond to user actions with subtle micro-animations. 
- **Premium Aesthetics:** Move away from generic flat design towards rich colors, depth, and curated typography.
- **Accessibility & Context:** Interfaces must adapt seamlessly to Light and Dark modes.

## 2. Typography
We use modern, highly legible sans-serif typefaces to ensure readability on small mobile screens while in transit.

- **Primary Font:** Inter (or system-ui fallback) for all UI elements.
- **Hierarchy:** 
  - `font-black` (900) or `font-extrabold` (800) for primary page headers and critical status text.
  - `font-medium` (500) for standard buttons and interactive elements.
  - `text-xs` (12px) for secondary labels, ensuring high density without losing legibility.

## 3. Color Palette & Theming
CampusFleet fully supports both **Light Mode** (default) and **Dark Mode**. We avoid plain colors (e.g., `#FF0000`) and use Tailwind's curated, vibrant scales.

- **Brand Primary:** Blue (`blue-600` light / `blue-500` dark) for action buttons and primary links.
- **Success / Go:** Green (`green-500` to `green-600`) for active passes, on-time buses, and success states.
- **Warning / Pending:** Yellow (`yellow-500`) for processing payments or delayed buses.
- **Danger / Stop:** Red (`red-500` to `red-600`) for locked access, missed buses, and errors.
- **Backgrounds:**
  - *Light Mode:* Soft off-white (`bg-gray-50`) for the canvas, pure white (`bg-white`) for cards.
  - *Dark Mode:* Deep gray/black (`bg-gray-950`) for the canvas, slightly lighter (`bg-gray-900` or `bg-gray-800/60`) for cards.

## 4. UI Components & Layouts

### The Standard CampusFleet Card
To simplify our UI and maintain a consistent look and feel across all pages (Settings, Commute Hub, Onboarding, Payments, etc.), **all** surfaces and modules must use this exact standard card pattern.

**Standard Card Classes:**
`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden`

**Code Example:**
```tsx
{/* The Standard Card Container */}
<div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
  
  {/* Card Header (Optional) */}
  <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/50 dark:bg-gray-900/20">
    <div className="flex items-center gap-3">
      {/* Icon with soft background */}
      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
        <IconName className="w-5 h-5" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Card Title</h2>
    </div>
    
    {/* Optional Top Right Action */}
    <button className="text-sm font-medium text-blue-600 hover:text-blue-700">Action</button>
  </div>
  
  {/* Card Body */}
  <div className="p-5 space-y-6">
    {/* Content goes here */}
    <p className="text-sm text-gray-500 dark:text-gray-400">
      This is the standard card content area. It has generous padding and spacing.
    </p>
  </div>
  
</div>
```

**Card Rules:**
- **No pure black:** Do not use `bg-black` for cards. Always use `bg-white dark:bg-gray-950`.
- **Corners:** Stick to `rounded-2xl` for large containing cards, and `rounded-xl` for inner interactive elements.
- **Dividers:** Use `<div className="h-px bg-gray-100 dark:bg-gray-800/60" />` to separate lists or rows inside the card body.
- **Interactive Cards:** If the *entire* card is clickable, add `cursor-pointer hover:scale-[1.01] hover:shadow-md transition-all duration-200`.

### Glassmorphism
- Use solid, vibrant backgrounds for primary actions with hover and active states (`hover:bg-blue-700 active:scale-95`).
- Ensure generous padding (`px-6 py-3`) so buttons are easy to tap on mobile devices.
- Include Lucide React icons alongside text for better visual scanning.

## 5. Animation & Motion
Motion is a core part of the CampusFleet identity. It reassures the user that the app is working and alive.

- **Micro-interactions:** Hover effects (`hover:scale-[1.02] hover:ring-2`) on clickable cards.
- **Page Transitions:** Use `animate-in fade-in zoom-in-95` on page load to softly bring content into view.
- **Status Indicators:** Use `animate-pulse` or `animate-ping` for live location tracking dots or pending statuses to convey real-time activity.

## 6. Mobile-First Optimization
Since 90% of students will use this on their phones while waiting for a bus:
- Avoid multi-column layouts that break on small screens. Use `flex-col` or `grid-cols-1`.
- Provide a `pb-24` padding on main content to prevent the sticky `MobileBottomNav` from obscuring data.
- Ensure touch targets are at least `44x44px`.
