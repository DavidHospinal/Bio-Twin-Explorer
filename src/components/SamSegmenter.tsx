import { useEffect, useState, useRef } from 'react';

interface SamSegmenterProps {
    imageSrc: string | null;
    onImageEmbeddingCalculated: () => void;
    onMaskGenerated: (mask: Float32Array, width: number, height: number) => void;
}

export const SamSegmenter = ({ imageSrc, onImageEmbeddingCalculated, onMaskGenerated }: SamSegmenterProps) => {
    const [status, setStatus] = useState<string>('Idle');
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    // Refs para callbacks estables
    const onEmbeddingRef = useRef(onImageEmbeddingCalculated);
    const onMaskRef = useRef(onMaskGenerated);

    useEffect(() => {
        onEmbeddingRef.current = onImageEmbeddingCalculated;
        onMaskRef.current = onMaskGenerated;
    }, [onImageEmbeddingCalculated, onMaskGenerated]);

    // Inicializar Worker - solo una vez
    useEffect(() => {
        workerRef.current = new Worker(
            new URL('../workers/samWorker.ts', import.meta.url),
            { type: 'module' }
        );

        workerRef.current.onmessage = (event: MessageEvent) => {
            const { type, payload } = event.data;

            switch (type) {
                case 'STATUS':
                    setStatus(payload.status);
                    break;
                case 'MODELS_LOADED':
                    setModelsLoaded(true);
                    break;
                case 'ENCODER_COMPLETE':
                    onEmbeddingRef.current();
                    break;
                case 'DECODER_COMPLETE':
                    onMaskRef.current(payload.maskData, payload.dims[2], payload.dims[3]);
                    break;
                case 'ERROR':
                    console.error('Worker error:', payload.message);
                    setStatus('Error: ' + payload.message);
                    break;
            }
        };

        workerRef.current.onerror = (error) => {
            console.error('Worker error:', error);
            setStatus('Worker Error');
        };

        // Cargar modelos
        workerRef.current.postMessage({ type: 'LOAD_MODELS' });

        return () => {
            workerRef.current?.terminate();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Solo inicializar una vez

    // Ejecutar encoder cuando cambia la imagen
    useEffect(() => {
        if (!imageSrc || !modelsLoaded || !workerRef.current) return;

        const runEncoder = async () => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.src = imageSrc;

            try {
                await img.decode();

                // Convertir imagen a tensor data
                const canvas = document.createElement('canvas');
                const width = 1024;
                const height = 1024;
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get canvas context');

                ctx.drawImage(img, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const { data } = imageData;

                // Convertir a Float32 HWC format
                const tensorData = new Float32Array(width * height * 3);
                const mean = [123.675, 116.28, 103.53];
                const std = [58.395, 57.12, 57.375];

                for (let i = 0; i < width * height; i++) {
                    const r = data[i * 4];
                    const g = data[i * 4 + 1];
                    const b = data[i * 4 + 2];

                    tensorData[i * 3] = (r - mean[0]) / std[0];
                    tensorData[i * 3 + 1] = (g - mean[1]) / std[1];
                    tensorData[i * 3 + 2] = (b - mean[2]) / std[2];
                }

                // Enviar al worker
                workerRef.current?.postMessage({
                    type: 'RUN_ENCODER',
                    payload: {
                        tensorData: tensorData,
                        shape: [height, width, 3]
                    }
                });
            } catch (e) {
                console.error('Error processing image:', e);
                setStatus('Image Error');
            }
        };

        runEncoder();
    }, [imageSrc, modelsLoaded]);

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-cyan-400 px-4 py-2 rounded-full text-xs font-mono border border-cyan-900 backdrop-blur-sm">
            AI Status: {status}
        </div>
    );
};

// Funcion para ejecutar decoder desde fuera del componente
export const runSamDecoder = (worker: Worker | null, x: number, y: number) => {
    if (!worker) {
        console.warn('Worker not ready');
        return;
    }
    worker.postMessage({
        type: 'RUN_DECODER',
        payload: { x, y }
    });
};
