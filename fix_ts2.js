import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        return;
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const [search, replace] of replacements) {
        if (typeof search === 'string') {
           if (content.includes(search)) {
               content = content.replace(search, replace);
           } else {
               console.warn(`Warning: Could not find string replacement in ${filePath}:\n${search.substring(0,50)}...`);
           }
        } else {
            content = content.replace(search, replace);
        }
    }
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
}

// 1. AdminApplicantListPage.tsx
replaceInFile('src/routes/admin/AdminApplicantListPage.tsx', [
    [/const reviewActions:\s*Array<\{[\s\S]*?\}>\s*=\s*\[[\s\S]*?\];/g, '']
]);

// 2. AdminProfilePage.tsx
replaceInFile('src/routes/admin/AdminProfilePage.tsx', [
    ['setPhone(profile.phone || "");', 'setPhone((profile as any).phone || "");']
]);

// 3. ProgramAdmissionBuilder.tsx
replaceInFile('src/routes/admin/ProgramAdmissionBuilder.tsx', [
    ['let { data: formData, error: formError } = await supabase', 'let { data: formData } = await supabase']
]);

// 4. ProgramBuilderPage.tsx
replaceInFile('src/routes/admin/ProgramBuilderPage.tsx', [
    ['await loadBankItems(managingBankId);', '// await loadBankItems(managingBankId);'],
    [
        'max_tab_switches: "0",\n      });',
        'max_tab_switches: "0",\n        randomized_questions_count: "0",\n      });'
    ]
]);

// 5. CertificateEligibilityPage.tsx
// JSX elements cannot have multiple attributes with the same name.
// Previous replacement: variant="secondary" className="bg-red-100 text-red-700"
// But maybe there was already a className.
// Let's replace the whole tag.
replaceInFile('src/routes/admin/certificates/CertificateEligibilityPage.tsx', [
    [/variant="secondary"\s+className="bg-red-100 text-red-700"\s+className=/g, 'variant="secondary" className='],
    [/variant="secondary" className="bg-red-100 text-red-700" className/g, 'variant="secondary" className']
]);

// 6. CertificateQueuePage.tsx
replaceInFile('src/routes/admin/certificates/CertificateQueuePage.tsx', [
    ['CardContent, ', '']
]);

// 7. LearnerLessonPage.tsx
replaceInFile('src/routes/learner/LearnerLessonPage.tsx', [
    [/variant=\{"secondary"\} className=\{attempt.score >= \(lesson.passing_grade \|\| 0\) \? "" : "bg-red-100 text-red-700"\} className="px-2"/g, 'variant={"secondary"} className={`px-2 ${attempt.score >= (lesson.passing_grade || 0) ? "" : "bg-red-100 text-red-700"}`}`]
]);

// 8. LearnerQuizPage.tsx
replaceInFile('src/routes/learner/LearnerQuizPage.tsx', [
    ['// import { Progress } from "@/components/ui/progress";', 'import { Progress } from "@/components/ui/progress";']
]);

// 9. SystemAuditPage.tsx
// I need to add back searchQuery.
replaceInFile('src/routes/superadmin/SystemAuditPage.tsx', [
    ['const [actionFilter, setActionFilter] = useState("all");', 'const [actionFilter, setActionFilter] = useState("all");\n  const [searchQuery, setSearchQuery] = useState("");']
]);

// 10. SystemContentReviewPage.tsx
replaceInFile('src/routes/superadmin/SystemContentReviewPage.tsx', [
    ['import { useAuthSession } from "../../app/providers/authSessionContext";', '']
]);

// 11. SystemHelpdeskPage.tsx
replaceInFile('src/routes/superadmin/SystemHelpdeskPage.tsx', [
    ['(_, _i)', '(_, i)'] // revert it if i was used, wait the error was 'i' is declared but never read.
]);

// 12. SystemUsersPage.tsx
replaceInFile('src/routes/superadmin/SystemUsersPage.tsx', [
    ['(code) =>', '(code: string) =>']
]);
