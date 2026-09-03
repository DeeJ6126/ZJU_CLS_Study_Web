// scripts/verify-demo-student-homepage.mjs
// One-off smoke check for the demo student-homepage flow.
// Run with: node scripts/verify-demo-student-homepage.mjs

import { demoAccountService, demoStudentHomepageClient } from '../src/services/demoAccountService.js';

console.log('--- demo student homepage smoke ---');
console.log('initial applications:', demoAccountService.listStudentHomepageApplications().length);
console.log('initial homepages:', demoAccountService.listStudentHomepages().length);

const submitted = demoStudentHomepageClient.submitApplication({
  name: '测试同学',
  href: 'https://demo.example/verify',
  note: 'smoke test',
});
console.log('submit result:', submitted.ok, submitted.application?.id);

const after = demoStudentHomepageClient.listApplications('');
console.log('applications after submit:', after.applications.length, 'pending:', after.pendingCount);

const approved = demoStudentHomepageClient.decideApplication(submitted.application.id, 'approve', 'ok');
console.log('approve result:', approved.ok, approved.application?.status);

const list = demoStudentHomepageClient.list('');
console.log('homepages after approve:', list.homepages.length);
