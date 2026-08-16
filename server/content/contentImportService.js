import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';

import { parseMarkdownDocument } from '../../src/utils/markdownContent.js';

const directoryTypes = {
  experiences: 'experience',
  materials: 'material',
  papers: 'paper',
};

function markdownFiles(rootDirectory) {
  const files = [];
  for (const category of readdirSync(rootDirectory, { withFileTypes: true })) {
    if (!category.isDirectory()) {
      continue;
    }
    const categoryPath = join(rootDirectory, category.name);
    for (const courseDirectory of readdirSync(categoryPath, { withFileTypes: true })) {
      if (!courseDirectory.isDirectory()) {
        continue;
      }
      const courseCode = courseDirectory.name.split('_')[0];
      const coursePath = join(categoryPath, courseDirectory.name);
      for (const [directory, type] of Object.entries(directoryTypes)) {
        const contentPath = join(coursePath, directory);
        if (!existsSync(contentPath)) {
          continue;
        }
        for (const entry of readdirSync(contentPath, { withFileTypes: true })) {
          if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            files.push({ courseCode, type, path: join(contentPath, entry.name) });
          }
        }
      }
    }
  }
  return files;
}

function publicUrlFor(rootDirectory, filePath) {
  const relativePath = relative(rootDirectory, filePath).split(sep).join('/');
  return `/resource/courses/${relativePath}`;
}

export function importStaticCourseContent(store, { rootDirectory }) {
  let imported = 0;
  for (const file of markdownFiles(rootDirectory)) {
    const sourcePath = relative(rootDirectory, file.path).split(sep).join('/');
    if (store.findBySourcePath(sourcePath)) {
      continue;
    }

    const document = parseMarkdownDocument(readFileSync(file.path, 'utf8'));
    const metadata = document.frontmatter;
    let attachedFile = null;
    if (metadata.fileUrl) {
      const diskPath = join(file.path, '..', basename(metadata.fileUrl));
      attachedFile = {
        fileName: metadata.fileName || basename(metadata.fileUrl),
        storedName: '',
        mimeType: 'application/pdf',
        size: existsSync(diskPath) ? readFileSync(diskPath).byteLength : 0,
        url: publicUrlFor(rootDirectory, diskPath),
      };
    }

    store.createItem({
      id: `static:${sourcePath}`,
      routeId: String(metadata.id || basename(file.path, '.md')),
      courseCode: file.courseCode,
      type: file.type,
      title: metadata.title || metadata.summary || '未命名内容',
      summary: metadata.summary || '',
      author: metadata.author || '',
      body: document.body,
      externalUrl: metadata.externalUrl || '',
      year: metadata.year || '',
      teacher: metadata.teacher || '',
      status: 'published',
      sourcePath,
      file: attachedFile,
    });
    imported += 1;
  }
  return { imported };
}
