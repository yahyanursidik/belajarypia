import fs from 'fs';
import path from 'path';

function replaceExact(filePath, searchStr, replaceStr) {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(searchStr)) {
        content = content.replace(searchStr, replaceStr);
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${filePath}`);
    } else {
        console.warn(`NOT FOUND in ${filePath}: ${searchStr.substring(0, 50)}`);
    }
}

// 1. AdminApplicantListPage.tsx
replaceExact('src/routes/admin/AdminApplicantListPage.tsx', 
`const reviewActions: Array<{
  status: ApplicantStatus;
  label: string;
  variant?: "default" | "outline" | "secondary";
}> = [
  { status: "under_review", label: "Mulai Review", variant: "outline" },
  { status: "revision_requested", label: "Minta Revisi", variant: "secondary" },
  { status: "rejected", label: "Reject", variant: "outline" },
];`, '');

// 2. AdminProfilePage.tsx
replaceExact('src/routes/admin/AdminProfilePage.tsx', 
`setPhone((profile as any).phone || "");`, 
`// setPhone((profile as any).phone || "");`);
replaceExact('src/routes/admin/AdminProfilePage.tsx', 
`setPhone(profile.phone || "");`, 
`// setPhone((profile as any).phone || "");`);

// 3. ProgramAdmissionBuilder.tsx
replaceExact('src/routes/admin/ProgramAdmissionBuilder.tsx', 
`let { data: formData, error: formError } = await supabase`, 
`let { data: formData } = await supabase`);

// 4. ProgramBuilderPage.tsx
replaceExact('src/routes/admin/ProgramBuilderPage.tsx', 
`await loadBankItems(managingBankId);`, 
`// await loadBankItems(managingBankId);`);
replaceExact('src/routes/admin/ProgramBuilderPage.tsx', 
`max_tab_switches: "0",
      });`, 
`max_tab_switches: "0",
        randomized_questions_count: "0",
      });`);

// 5. CertificateEligibilityPage.tsx
replaceExact('src/routes/admin/certificates/CertificateEligibilityPage.tsx', 
`className="bg-red-100 text-red-700" className="font-normal"`, 
`className="bg-red-100 text-red-700 font-normal"`);

// 6. CertificateQueuePage.tsx
replaceExact('src/routes/admin/certificates/CertificateQueuePage.tsx', 
`import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";`, 
`import { Card, CardHeader, CardTitle } from "@/components/ui/card";`);

// 7. LearnerLessonPage.tsx
replaceExact('src/routes/learner/LearnerLessonPage.tsx', 
`className={attempt.score >= (lesson.passing_grade || 0) ? "" : "bg-red-100 text-red-700"} className="px-2"`, 
`className={\`px-2 \${attempt.score >= (lesson.passing_grade || 0) ? "" : "bg-red-100 text-red-700"}\`}`);

// 8. LearnerQuizPage.tsx
replaceExact('src/routes/learner/LearnerQuizPage.tsx', 
`// import { Progress } from "@/components/ui/progress";`, 
`import { Progress } from "@/components/ui/progress";`);
replaceExact('src/routes/learner/LearnerQuizPage.tsx', 
`ref={(el) => (questionRefs.current[index] = el)}`, 
`ref={(el) => { questionRefs.current[index] = el; }}`);

// 9. SystemAuditPage.tsx
replaceExact('src/routes/superadmin/SystemAuditPage.tsx', 
`const [actionFilter, setActionFilter] = useState("all");`, 
`const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");`);

// 10. SystemContentReviewPage.tsx
replaceExact('src/routes/superadmin/SystemContentReviewPage.tsx', 
`import { useAuthSession } from "../../app/providers/authSessionContext";`, 
``);

// 11. SystemHelpdeskPage.tsx
replaceExact('src/routes/superadmin/SystemHelpdeskPage.tsx', 
`(_, _i)`, 
`(_, i)`);

// 12. SystemUsersPage.tsx
replaceExact('src/routes/superadmin/SystemUsersPage.tsx', 
`(code) =>`, 
`(code: string) =>`);

console.log("Fixes applied!");
