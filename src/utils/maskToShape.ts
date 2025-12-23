import * as THREE from 'three';

// Analiza la mascara y extrae estadisticas
export function analyzeMask(maskData: Float32Array, _width: number, _height: number): {
    minVal: number;
    maxVal: number;
    positiveCount: number;
    total: number;
} {
    let minVal = Infinity;
    let maxVal = -Infinity;
    let positiveCount = 0;

    for (let i = 0; i < maskData.length; i++) {
        const val = maskData[i];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
        if (val > 0) positiveCount++;
    }

    return { minVal, maxVal, positiveCount, total: maskData.length };
}

// Encuentra el bounding box de la mascara
function findMaskBounds(maskData: Float32Array, width: number, height: number, threshold: number = 0): {
    minX: number; maxX: number; minY: number; maxY: number;
} {
    let minX = width, maxX = 0, minY = height, maxY = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (maskData[y * width + x] > threshold) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    return { minX, maxX, minY, maxY };
}

// Convierte mascara a textura para usar como alpha map
export function maskToTexture(maskData: Float32Array, width: number, height: number): THREE.DataTexture {
    const stats = analyzeMask(maskData, width, height);
    console.log('Mask stats:', stats);

    // Normalizar datos
    const imageData = new Uint8Array(width * height * 4);
    const range = stats.maxVal - stats.minVal || 1;

    for (let i = 0; i < maskData.length; i++) {
        const normalized = (maskData[i] - stats.minVal) / range;
        const alpha = Math.min(255, Math.max(0, normalized * 255));
        imageData[i * 4] = 255;     // R
        imageData[i * 4 + 1] = 255; // G
        imageData[i * 4 + 2] = 255; // B
        imageData[i * 4 + 3] = alpha; // A
    }

    const texture = new THREE.DataTexture(imageData, width, height, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

// Genera puntos para sistema de particulas desde la mascara
export function maskToParticles(
    maskData: Float32Array,
    width: number,
    height: number,
    sampleRate: number = 8
): Float32Array {
    const points: number[] = [];
    const stats = analyzeMask(maskData, width, height);
    const threshold = stats.minVal + (stats.maxVal - stats.minVal) * 0.3;

    for (let y = 0; y < height; y += sampleRate) {
        for (let x = 0; x < width; x += sampleRate) {
            if (maskData[y * width + x] > threshold) {
                // Normalizar a rango [-3, 3] 
                const px = (x / width - 0.5) * 6;
                const py = (0.5 - y / height) * 6;
                const pz = (Math.random() - 0.5) * 0.5; // Leve profundidad aleatoria
                points.push(px, py, pz);
            }
        }
    }

    console.log('Particles generated:', points.length / 3);
    return new Float32Array(points);
}

// Genera shapes simplificados usando bounding box y sampling
export function maskToShapes(
    maskData: Float32Array,
    width: number,
    height: number
): THREE.Shape[] {
    const stats = analyzeMask(maskData, width, height);
    console.log('Mask analysis:', stats);

    // Si no hay suficientes pixeles positivos, retornar vacio
    if (stats.positiveCount < 100) {
        console.log('Not enough positive pixels for shapes');
        return [];
    }

    const threshold = stats.minVal + (stats.maxVal - stats.minVal) * 0.3;
    const bounds = findMaskBounds(maskData, width, height, threshold);

    // Verificar que hay un area valida
    const areaWidth = bounds.maxX - bounds.minX;
    const areaHeight = bounds.maxY - bounds.minY;

    if (areaWidth < 10 || areaHeight < 10) {
        console.log('Mask area too small');
        return [];
    }

    // Crear shape rectangular simple del area segmentada
    const shape = new THREE.Shape();

    // Normalizar a rango [-2, 2]
    const x1 = (bounds.minX / width - 0.5) * 4;
    const x2 = (bounds.maxX / width - 0.5) * 4;
    const y1 = (0.5 - bounds.maxY / height) * 4;
    const y2 = (0.5 - bounds.minY / height) * 4;

    shape.moveTo(x1, y1);
    shape.lineTo(x2, y1);
    shape.lineTo(x2, y2);
    shape.lineTo(x1, y2);
    shape.closePath();

    console.log('Shape created with bounds:', { x1, x2, y1, y2 });

    return [shape];
}

// Exportar utilidades adicionales
export { analyzeMask as getMaskStats };
