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

    // Convert to Float32 CHW format (1, 3, 1024, 1024)
    const tensorData = new Float32Array(width * height * 3);

    // Mean and Std for normalization (usual ImageNet stats)
    // Pixel values 0-255.
    // However, the standard SAM preprocessing usually expects:
    // (pixel - mean) / std. 
    // Usually standard is: mean=[123.675, 116.28, 103.53], std=[58.395, 57.12, 57.375]

    const mean = [123.675, 116.28, 103.53];
    const std = [58.395, 57.12, 57.375];

    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];

        tensorData[i] = (r - mean[0]) / std[0]; // R
        tensorData[i + width * height] = (g - mean[1]) / std[1]; // G
        tensorData[i + 2 * width * height] = (b - mean[2]) / std[2]; // B
    }

    // SAM model expects 3D input: [3, height, width] (CHW format, no batch dimension)
    return new Tensor('float32', tensorData, [3, height, width]);
}

// Convert model output mask to Float32Array
export function maskToImage(maskTensor: Tensor): Float32Array {
    return maskTensor.data as Float32Array;
}
