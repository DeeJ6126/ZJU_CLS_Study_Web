import { createRequestClient } from './apiClient.js';

export function createStudentHomepageApiClient(fetchImpl = fetch) {
  const { request } = createRequestClient({
    name: 'student-homepages',
    fetchImpl,
    networkErrorMessage: '同学主页服务暂时无法连接。',
  });
  return {
    fetchHomepages: () => request('api/student-homepages'),
    submitApplication: (input) => request('api/student-homepages/applications', { method: 'POST', body: input }),
  };
}

export async function imageFileToAvatarDataUrl(file) {
  if (!file?.type?.startsWith('image/') || file.size > 2 * 1024 * 1024) {
    throw new Error('请选择不超过 2 MB 的图片。');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const side = Math.min(bitmap.width, bitmap.height);
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
    const result = canvas.toDataURL('image/webp', 0.78);
    if (!result.startsWith('data:image/webp;base64,') || result.length > 200000) {
      throw new Error('图片处理后仍过大，请换一张图片。');
    }
    return result;
  } finally {
    bitmap.close();
  }
}

export const studentHomepageApiClient = createStudentHomepageApiClient();
