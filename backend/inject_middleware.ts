import fs from 'fs';
import path from 'path';

const routesDir = path.join(__dirname, 'src', 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Check if we need to add the import first
  const needsImport = /router\.(delete|post|put|patch)\(/.test(content);
  if (!needsImport) return;

  if (!content.includes('checkPermission')) {
    content = content.replace(
      /import \{ authMiddleware, requireRole \} from '\.\.\/middleware\/auth';/,
      `import { authMiddleware, requireRole } from '../middleware/auth';\nimport { checkPermission } from '../middlewares/checkPermission';`
    );
  }

  // 1. DELETE -> canDelete
  content = content.replace(
    /router\.delete\((.*?), authMiddleware, requireRole\('ADMIN'\), (?!checkPermission)/g,
    `router.delete($1, authMiddleware, requireRole('ADMIN'), checkPermission('canDelete'), `
  );

  // 2. POST emails -> canSendEmails (file: dispatches.ts and others if sending)
  if (file === 'dispatches.ts' || file === 'nps.ts') {
    // Para dispatches
    content = content.replace(
      /router\.post\((.*?), authMiddleware, requireRole\('ADMIN'\), (?!checkPermission)/g,
      `router.post($1, authMiddleware, requireRole('ADMIN'), checkPermission('canSendEmails'), `
    );
  } else {
      // 3. POST -> canCreate
      content = content.replace(
        /router\.post\((.*?), authMiddleware, requireRole\('ADMIN'\), (?!checkPermission)/g,
        `router.post($1, authMiddleware, requireRole('ADMIN'), checkPermission('canCreate'), `
      );
  }

  // PUT / PATCH -> canEdit
  content = content.replace(
    /router\.put\((.*?), authMiddleware, requireRole\('ADMIN'\), (?!checkPermission)/g,
    `router.put($1, authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), `
  );
  content = content.replace(
    /router\.patch\((.*?), authMiddleware, requireRole\('ADMIN'\), (?!checkPermission)/g,
    `router.patch($1, authMiddleware, requireRole('ADMIN'), checkPermission('canEdit'), `
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed ${file}`);
});
