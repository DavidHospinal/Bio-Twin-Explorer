import * as THREE from 'three';

interface Point {
    x: number;
    y: number;
}

// Convierte mascara binaria a puntos de contorno usando marching squares simplificado
export function maskToContour(
    maskData: Float32Array,
    width: number,
    height: number,
    threshold: number = 0.5
): Point[][] {
    const contours: Point[][] = [];
    const visited = new Set<string>();

    // Funcion para obtener valor de mascara
    const getMask = (x: number, y: number): boolean => {
        if (x < 0 || x >= width || y < 0 || y >= height) return false;
        return maskData[y * width + x] > threshold;
    };

    // Encontrar bordes y trazar contornos
    for (let y = 0; y < height - 1; y += 4) { // Samplear cada 4 pixeles para rendimiento
        for (let x = 0; x < width - 1; x += 4) {
            const key = `${x},${y}`;
            if (visited.has(key)) continue;

            // Detectar borde (transicion de mascara)
            const current = getMask(x, y);
            const right = getMask(x + 1, y);
            const bottom = getMask(x, y + 1);

            if (current !== right || current !== bottom) {
                if (current) {
                    // Trazar contorno desde este punto
                    const contour = traceContour(maskData, width, height, x, y, threshold, visited);
                    if (contour.length > 10) { // Minimo 10 puntos para un contorno valido
                        contours.push(contour);
                    }
                }
            }
        }
    }

    return contours;
}

// Traza un contorno desde un punto inicial
function traceContour(
    maskData: Float32Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    threshold: number,
    visited: Set<string>
): Point[] {
    const contour: Point[] = [];
    const directions = [
        [1, 0], [1, 1], [0, 1], [-1, 1],
        [-1, 0], [-1, -1], [0, -1], [1, -1]
    ];

    let x = startX;
    let y = startY;
    let prevDir = 0;
    const maxPoints = 500;

    const getMask = (px: number, py: number): boolean => {
        if (px < 0 || px >= width || py < 0 || py >= height) return false;
        return maskData[py * width + px] > threshold;
    };

    for (let i = 0; i < maxPoints; i++) {
        const key = `${x},${y}`;
        if (visited.has(key) && contour.length > 5) break;
        visited.add(key);

        // Normalizar coordenadas a rango [-1, 1]
        contour.push({
            x: (x / width) * 2 - 1,
            y: (y / height) * 2 - 1
        });

        // Buscar siguiente punto en el borde
        let found = false;
        for (let d = 0; d < 8; d++) {
            const dir = (prevDir + d + 5) % 8; // Buscar en sentido horario
            const nx = x + directions[dir][0] * 4;
            const ny = y + directions[dir][1] * 4;

            if (getMask(nx, ny) && !getMask(nx + directions[(dir + 2) % 8][0], ny + directions[(dir + 2) % 8][1])) {
                x = nx;
                y = ny;
                prevDir = dir;
                found = true;
                break;
            }
        }

        if (!found) break;
    }

    return contour;
}

// Convierte contorno a Shape de Three.js
export function contourToShape(contour: Point[]): THREE.Shape {
    const shape = new THREE.Shape();

    if (contour.length === 0) return shape;

    shape.moveTo(contour[0].x, contour[0].y);

    for (let i = 1; i < contour.length; i++) {
        shape.lineTo(contour[i].x, contour[i].y);
    }

    shape.closePath();
    return shape;
}

// Simplifica contorno reduciendo puntos
export function simplifyContour(contour: Point[], tolerance: number = 0.02): Point[] {
    if (contour.length < 3) return contour;

    const simplified: Point[] = [contour[0]];

    for (let i = 1; i < contour.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const current = contour[i];
        const distance = Math.sqrt(
            Math.pow(current.x - prev.x, 2) +
            Math.pow(current.y - prev.y, 2)
        );

        if (distance > tolerance) {
            simplified.push(current);
        }
    }

    simplified.push(contour[contour.length - 1]);
    return simplified;
}

// Funcion principal: mascara a shapes
export function maskToShapes(
    maskData: Float32Array,
    width: number,
    height: number
): THREE.Shape[] {
    const contours = maskToContour(maskData, width, height);
    const shapes: THREE.Shape[] = [];

    for (const contour of contours) {
        const simplified = simplifyContour(contour);
        if (simplified.length > 3) {
            shapes.push(contourToShape(simplified));
        }
    }

    return shapes;
}
