with open('src/components/staff/routes/stops/StopBuilderModal.tsx', 'r') as f:
    text = f.read()

# Replace fixed inset-0 with w-full
import re
pattern = r'<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">\s*<div className="w-full max-w-4xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-\[90vh\]">'
new_code = '<div className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl shadow-sm overflow-hidden flex flex-col" style={{ height: "calc(100vh - 120px)" }}>'
text = re.sub(pattern, new_code, text)

# Also remove the closing </div> for the fixed wrapper.
# At the end, there is:
#         </div>
#       )}
# We need to change that to:
#       )}
# Wait, actually since we replaced two <div> tags with one <div> tag in the new_code, we need to remove one closing </div> tag.
# We'll just replace the last </div>\n      )} with       )}
text = text.replace('        </div>\n      )}\n    </>\n  );\n}', '      )}\n    </>\n  );\n}')


with open('src/components/staff/routes/stops/StopBuilderModal.tsx', 'w') as f:
    f.write(text)
