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

### Cards & Containers
- **Corner Radius:** Use highly rounded corners (`rounded-2xl` or `rounded-3xl`) to create a friendly, modern feel.
- **Borders & Shadows:** Use subtle borders (`border-gray-200 dark:border-gray-800`) combined with soft drop shadows (`shadow-xl`) to lift cards off the background.
- **Glassmorphism:** For overlays, sticky headers, or bottom navigation, use backdrop blur (`backdrop-blur-xl bg-white/80 dark:bg-gray-950/80`) to provide context behind floating elements.

#### Standard Card Design Snippet
Use this foundational structure for cards across all pages to ensure UI consistency:

```tsx
<div className="bg-white dark:bg-gray-800/60 backdrop-blur-xl border border-gray-200 dark:border-gray-800/60 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all">
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center gap-3">
      <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white">Card Title</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">Card Subtitle</p>
      </div>
    </div>
    <Badge className="bg-green-100 text-green-700">Status</Badge>
  </div>
  <div className="space-y-3">
    {/* Card Content Here */}
  </div>
</div>
```

### Buttons & Interactive Elements
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
