export const MAX_EDITOR_IMAGE_FILE_SIZE = 1024 * 1024;
export const ACCEPTED_EDITOR_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 정보를 불러오지 못했습니다.'));
    };

    image.src = objectUrl;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 변환에 실패했습니다.'));
          return;
        }

        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}

export async function convertImageToWebpFile(file: File) {
  if (!ACCEPTED_EDITOR_IMAGE_TYPES.includes(file.type)) {
    throw new Error('png, jpeg, webp 이미지만 등록할 수 있습니다.');
  }

  if (file.size > MAX_EDITOR_IMAGE_FILE_SIZE) {
    throw new Error('이미지는 1MB 이하로 등록해주세요.');
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 변환에 실패했습니다.');
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  for (const quality of [0.92, 0.86, 0.8, 0.74, 0.68]) {
    const blob = await canvasToWebpBlob(canvas, quality);

    if (blob.size <= MAX_EDITOR_IMAGE_FILE_SIZE) {
      const baseName = file.name.replace(/\.[^.]+$/, '') || `editor-${Date.now()}`;

      return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
    }
  }

  throw new Error('이미지는 1MB 이하로 등록해주세요.');
}
