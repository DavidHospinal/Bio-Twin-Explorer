import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';

interface SamSegmenterProps {
    imageSrc: string | null;
    onImageEmbeddingCalculated: () => void;
    onMaskGenerated: (mask: Float32Array, width: number, height: number) => void;
}

export interface SamSegmenterRef {
    runDecoder: (x: number, y: number) => void;
}

export const SamSegmenter = forwardRef<SamSegmenterRef, SamSegmenterProps>(
    ({ imageSrc, onImageEmbeddingCalculated, onMaskGenerated }, ref) => {
        const [status, setStatus] = useState<string>('Idle');
        const [modelsLoaded, setModelsLoaded] = useState(false);
        const [embeddingReady, setEmbeddingReady] = useState(false);
        const workerRef = useRef<Worker | null>(null);

        // Refs para callbacks estables
        const onEmbeddingRef = useRef(onImageEmbeddingCalculated);
        const onMaskRef = useRef(onMaskGenerated);

        useEffect(() => {
            onEmbeddingRef.current = onImageEmbeddingCalculated;
            onMaskRef.current = onMaskGenerated;
        }, [onImageEmbeddingCalculated, onMaskGenerated]);

        // Exponer funcion para llamar al decoder
        useImperativeHandle(ref, () => ({
            runDecoder: (x: number, y: number) => {
                if (!workerRef.current || !embeddingReady) {
                    console.warn('Decoder not ready');
                    return;
                }
                setStatus('Decoding...');
                workerRef.current.postMessage({
                    type: 'RUN_DECODER',
                    payload: { x, y }
                });
            }
        }), [embeddingReady]);

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
                        setEmbeddingReady(true);
                        onEmbeddingRef.current();
                        break;
                    case 'DECODER_COMPLETE':
                        setStatus('Mask Generated');
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
        }, []);

        // Ejecutar encoder cuando cambia la imagen
        useEffect(() => {
            if (!imageSrc || !modelsLoaded || !workerRef.current) return;

            setEmbeddingReady(false);

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
    });

SamSegmenter.displayName = 'SamSegmenter';
