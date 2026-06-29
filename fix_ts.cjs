const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
        console.error(`File not found: ${fullPath}`);
        return;
    }
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
}

// 1. AdminAnnouncementsPage.tsx
replaceInFile('src/routes/admin/AdminAnnouncementsPage.tsx', [
    [/Edit,\s*Save,\s*/g, '']
]);

// 2. AdminApplicantListPage.tsx
replaceInFile('src/routes/admin/AdminApplicantListPage.tsx', [
    [/const reviewActions = \[[\s\S]*?\];/g, ''],
    [/variant="destructive"/g, 'variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-200"']
]);

// 3. AdminFinancePage.tsx
replaceInFile('src/routes/admin/AdminFinancePage.tsx', [
    [/Calendar,\s*/g, ''],
    [/,\s*MoreVertical/g, ''],
    [/,\s*ArrowUpRight/g, '']
]);

// 4. AdminParticipantListPage.tsx
replaceInFile('src/routes/admin/AdminParticipantListPage.tsx', [
    [/,\s*Clock,\s*Ban/g, ''],
    [/variant="link"/g, 'variant="ghost"']
]);

// 5. AdminProfilePage.tsx
replaceInFile('src/routes/admin/AdminProfilePage.tsx', [
    [/const { session, profile, primaryRole/g, 'const { profile, primaryRole'],
    [/full_name: string \| null;\n  email: string \| null;/g, 'full_name: string | null;\n  email: string | null;\n  phone?: string | null;'],
    [/primaryRole\.replace/g, 'primaryRole?.replace']
]);

// 6. ProgramAdmissionBuilder.tsx
replaceInFile('src/routes/admin/ProgramAdmissionBuilder.tsx', [
    [/const \[formError, setFormError\]/g, 'const [, setFormError]']
]);

// 7. ProgramBuilderPage.tsx
replaceInFile('src/routes/admin/ProgramBuilderPage.tsx', [
    [/max_tab_switches: "0",\n/g, 'max_tab_switches: "0",\n        randomized_questions_count: "0",\n'],
    [/loadBankItems\(\)/g, ''] // Will check if this needs manual fix
]);

// 8. CertificateEligibilityPage.tsx
replaceInFile('src/routes/admin/certificates/CertificateEligibilityPage.tsx', [
    [/variant="destructive"/g, 'variant="secondary" className="bg-red-100 text-red-700"']
]);

// 9. CertificateQueuePage.tsx
replaceInFile('src/routes/admin/certificates/CertificateQueuePage.tsx', [
    [/CardContent,\s*/g, '']
]);

// 10. CertificateTemplatesPage.tsx
replaceInFile('src/routes/admin/certificates/CertificateTemplatesPage.tsx', [
    [/CardContent,\s*CardHeader,\s*CardTitle\s*\} from/g, '} from']
]);

// 11. LearnerHelpPage.tsx
replaceInFile('src/routes/learner/LearnerHelpPage.tsx', [
    [/const \[newTicketPriority, setNewTicketPriority\] = useState\("medium"\);/g, 'const [newTicketPriority] = useState("medium");']
]);

// 12. LearnerLessonPage.tsx
replaceInFile('src/routes/learner/LearnerLessonPage.tsx', [
    [/variant=\{attempt\.score >= \(lesson\.passing_grade \|\| 0\) \? "default" : "destructive"\}/g, 'variant={attempt.score >= (lesson.passing_grade || 0) ? "default" : "secondary"} className={attempt.score >= (lesson.passing_grade || 0) ? "" : "bg-red-100 text-red-700"}']
]);

// 13. LearnerProfilePage.tsx
replaceInFile('src/routes/learner/LearnerProfilePage.tsx', [
    [/X,\s*/g, '']
]);

// 14. LearnerQuizPage.tsx
replaceInFile('src/routes/learner/LearnerQuizPage.tsx', [
    [/import \{ Progress \} from "@\/components\/ui\/progress";\n/g, ''],
    [/ref=\{\(el\) => \(questionRefs\.current\[index\] = el\)\}/g, 'ref={(el) => { questionRefs.current[index] = el; }}']
]);

// 15. ProgramRegistrationPage.tsx
replaceInFile('src/routes/public/ProgramRegistrationPage.tsx', [
    [/<CardDescription>/g, '<AlertDescription>'],
    [/<\/CardDescription>/g, '</AlertDescription>']
]);

// 16. SuperAdminDashboardPage.tsx
replaceInFile('src/routes/superadmin/SuperAdminDashboardPage.tsx', [
    [/Headset,\s*/g, '']
]);

// 17. SystemAuditPage.tsx
replaceInFile('src/routes/superadmin/SystemAuditPage.tsx', [
    [/import \{ Input \} from "@\/components\/ui\/input";\n/g, ''],
    [/Search,\s*/g, ''],
    [/const \[searchQuery, setSearchQuery\] = useState\(""\);\n/g, '']
]);

// 18. SystemContentReviewPage.tsx
replaceInFile('src/routes/superadmin/SystemContentReviewPage.tsx', [
    [/const \{ user \} = useAuthSession\(\);\n/g, '']
]);

// 19. SystemHelpdeskPage.tsx
replaceInFile('src/routes/superadmin/SystemHelpdeskPage.tsx', [
    [/,\s*MoreVertical/g, ''],
    [/ChevronDown,\s*/g, ''],
    [/\(_, i\)/g, '(_, _i)']
]);

// 20. SystemUsersPage.tsx
replaceInFile('src/routes/superadmin/SystemUsersPage.tsx', [
    [/\(code\) => /g, '(code: string) => ']
]);

console.log('Done running replacements.');
