import { Tensor } from 'onnxruntime-web';

// Helper to convert ImageBitmap or HTMLImageElement to Tensor for Encoder
export async function imageToTensor(image: HTMLImageElement): Promise<Tensor> {
    const canvas = document.createElement('canvas');
    // SAM expects 1024x1024 input
    const width = 1024;
    const height = 1024;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    // Draw and resize
    ctx.drawImage(image, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    // Convert to Float32 HWC format [height, width, 3] - SAM quantized model expects this format
    const tensorData = new Float32Array(width * height * 3);

    // Mean and Std for normalization (ImageNet stats used by SAM)
    const mean = [123.675, 116.28, 103.53];
    const std = [58.395, 57.12, 57.375];

    // HWC layout: for each pixel, store R, G, B consecutively
    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];

        tensorData[i * 3] = (r - mean[0]) / std[0];     // R
        tensorData[i * 3 + 1] = (g - mean[1]) / std[1]; // G
        tensorData[i * 3 + 2] = (b - mean[2]) / std[2]; // B
    }

    // SAM quantized model expects 3D input: [height, width, 3] (HWC format)
    return new Tensor('float32', tensorData, [height, width, 3]);
}

// Convert model output mask to Float32Array
export function maskToImage(maskTensor: Tensor): Float32Array {
    return maskTensor.data as Float32Array;
}
