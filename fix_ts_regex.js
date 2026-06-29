import fs from 'fs';
import path from 'path';

function replaceRegex(filePath, replacements) {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) return;
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const [regex, replaceStr] of replacements) {
        content = content.replace(regex, replaceStr);
    }
    fs.writeFileSync(fullPath, content);
    console.log(`Updated ${filePath}`);
}

replaceRegex('src/routes/admin/AdminApplicantListPage.tsx', [
    [/const reviewActions: Array<\{[\s\S]*?\}\s*>\s*=\s*\[[\s\S]*?\];/g, '']
]);

replaceRegex('src/routes/admin/certificates/CertificateQueuePage.tsx', [
    [/CardContent,\s*/g, '']
]);

replaceRegex('src/routes/admin/ProgramBuilderPage.tsx', [
    [/max_tab_switches: "0",/g, 'max_tab_switches: "0",\n        randomized_questions_count: "0",']
]);

replaceRegex('src/routes/learner/LearnerQuizPage.tsx', [
    [/import \{ Button \} from "@\/components\/ui\/button";/g, 'import { Button } from "@/components/ui/button";\nimport { Progress } from "@/components/ui/progress";'],
    [/ref=\{\(el\) => questionRefs\.current\[q\.id\] = el\}/g, 'ref={(el) => { questionRefs.current[q.id] = el; }}'],
    [/ref=\{\(el\) => \(questionRefs\.current\[q\.id\] = el\)\}/g, 'ref={(el) => { questionRefs.current[q.id] = el; }}']
]);

replaceRegex('src/routes/superadmin/SystemAuditPage.tsx', [
    [/if \(searchQuery\.trim\(\)\) query = query\.or\(\`profiles\.full_name\.ilike\.%\$\{searchQuery\}%\`\);\n/g, ''],
    [/, searchQuery\]\);/g, ']);']
]);

replaceRegex('src/routes/superadmin/SystemContentReviewPage.tsx', [
    [/import \{ useAuthSession \} from "@\/app\/providers\/authSessionContext";\n/g, '']
]);

replaceRegex('src/routes/superadmin/SystemHelpdeskPage.tsx', [
    [/\(_, i\)/g, '(_, _i)']
]);

replaceRegex('src/routes/superadmin/SystemUsersPage.tsx', [
    [/\(code\) => /g, '(code: string) => ']
]);

console.log("Regex Fixes applied!");
