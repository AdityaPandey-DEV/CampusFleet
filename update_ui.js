const fs = require('fs');
const file = 'src/components/portal/PortalPaymentsView.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace isPendingApproval logic
code = code.replace(
  /const isPendingApproval =[\s\S]*?pendingSubmissions\.some[^\)]+\)\);/,
  `const currentPaid = Number(activeStudent?.totalFeePaid || 0);
  const pendingAmountVal = pendingSubmissions
    .filter((s: any) => s.status === "PENDING_APPROVAL")
    .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
  const totalSubmittedOrApproved = currentPaid + pendingAmountVal;
  
  const isFullySubmitted =
    !isPassApproved &&
    (currentZone?.semesterFee > 0 && totalSubmittedOrApproved >= currentZone.semesterFee);`
);

// Replace variable name in UI
code = code.replace(/isPendingApproval/g, 'isFullySubmitted');

// Update button text
code = code.replace(
  /<span>Send Receipt for Staff Verification<\/span>/g,
  '<span>Submit Payment Receipt</span>'
);

// Update blocked message
code = code.replace(
  /Payment Verification in Progress/g,
  'All Receipts Submitted — Verification in Progress'
);

// Also add helper text about uploading multiple
code = code.replace(
  /<p className="text-xs sm:text-sm text-slate-500 mt-1">/g,
  '<p className="text-xs sm:text-sm text-slate-500 mt-1">\n            You can upload multiple receipts until your total semester fee is paid.'
);

fs.writeFileSync(file, code);
console.log("Updated PortalPaymentsView.tsx");
