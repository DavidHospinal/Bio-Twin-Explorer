import { useEffect, useState } from 'react';
import * as ort from 'onnxruntime-web';
import { imageToTensor } from '../utils/samHelpers';

// Configure WASM paths - Use local files (now synchronized with npm version)
ort.env.wasm.wasmPaths = "/";

interface SamSegmenterProps {
    imageSrc: string | null;
    onImageEmbeddingCalculated: () => void;
    onMaskGenerated: (mask: Float32Array, width: number, height: number) => void;
}

// Global sessions to avoid reloading
let encoderSession: ort.InferenceSession | null = null;
let decoderSession: ort.InferenceSession | null = null;
let imageEmbedding: ort.Tensor | null = null;

export const SamSegmenter = ({ imageSrc, onImageEmbeddingCalculated }: SamSegmenterProps) => {
    const [status, setStatus] = useState<string>('Idle');

    // Load Models
    useEffect(() => {
        const loadModels = async () => {
            try {
                // Opciones para usar WebGL (GPU) con fallback a WASM (CPU)
                const sessionOptions: ort.InferenceSession.SessionOptions = {
                    executionProviders: ['webgl', 'wasm'],
                    graphOptimizationLevel: 'all'
                };

                if (!encoderSession) {
                    setStatus('Loading Encoder...');
                    encoderSession = await ort.InferenceSession.create(
                        '/models/sam_vit_b_01ec64.quant.encoder.onnx',
                        sessionOptions
                    );
                }
                if (!decoderSession) {
                    setStatus('Loading Decoder...');
                    decoderSession = await ort.InferenceSession.create(
                        '/models/sam_vit_b_01ec64.quant.decoder.onnx',
                        sessionOptions
                    );
                }
                setStatus('Models Loaded');
            } catch (e) {
                console.error(e);
                setStatus('Error loading models');
            }
        };
        loadModels();
    }, []);

    // Run Encoder when image changes
    useEffect(() => {
        if (!imageSrc || !encoderSession) return;

        const runEncoder = async () => {
            setStatus('Encoding Image...');
            try {
                const img = new Image();
                img.crossOrigin = 'Anonymous';
                img.src = imageSrc;
                await img.decode();

                const tensor = await imageToTensor(img);
                const feeds = { input_image: tensor };

                const results = await encoderSession!.run(feeds);
                imageEmbedding = results.image_embeddings;
                // Note: Check model output name. Usually 'image_embeddings'.

                setStatus('Embedding Ready');
                onImageEmbeddingCalculated();
                tensor.dispose();
            } catch (e) {
                console.error(e);
                setStatus('Encoder Error');
            }
        };

        runEncoder();
    }, [imageSrc, onImageEmbeddingCalculated]);

    // We expose a function to run the decoder, but since this is a component, 
    // maybe we should expose via Ref or Context. For now, let's attach to window or just export logic.
    // Better: This component listens to an event or we move logic to a hook.
    // For the prototype, let's export a helper logic separate from the UI component?
    // Or keep internal state.

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 text-cyan-400 px-4 py-2 rounded-full text-xs font-mono border border-cyan-900 backdrop-blur-sm">
            AI Status: {status}
        </div>
    );
};

// Export Decoder function for use in App
export const runSamDecoder = async (x: number, y: number) => {
    if (!decoderSession || !imageEmbedding) {
        console.warn("Decoder not ready");
        return null;
    }

    try {
        // Prepare inputs
        // Point coords: (1, 2, 2) - Normalized or Pixel? 
        // SAM decoder expects pixel coordinates in 1024x1024 space usually, or original image space if resized.
        // Our ImageToTensor resized to 1024x1024. Use that.

        // Inputs:
        // image_embeddings: from encoder
        // point_coords: (1, N, 2)
        // point_labels: (1, N)
        // mask_input: (1, 1, 256, 256) (optional)
        // has_mask_input: (1)
        // orig_im_size: (2)

        const pointCoords = new Float32Array([x * 1024, y * 1024]); // Single point
        const pointLabels = new Float32Array([1]); // 1 = Foreground point

        const pointCoordsTensor = new ort.Tensor('float32', pointCoords, [1, 1, 2]);
        const pointLabelsTensor = new ort.Tensor('float32', pointLabels, [1, 1]);

        const maskInput = new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]);
        const hasMaskInput = new ort.Tensor('float32', new Float32Array([0]), [1]);
        const origImSize = new ort.Tensor('float32', new Float32Array([1024, 1024]), [2]);

        const feeds = {
            image_embeddings: imageEmbedding,
            point_coords: pointCoordsTensor,
            point_labels: pointLabelsTensor,
            mask_input: maskInput,
            has_mask_input: hasMaskInput,
            orig_im_size: origImSize
        };

        const results = await decoderSession.run(feeds);
        // masks: (1, 4, 1024, 1024) - low res usually, need post process?
        // Check specific model output. Usually 'masks'.
        const masks = results.masks;

        // Return the first mask
        return masks;
    } catch (e) {
        console.error("Decoder Error", e);
        return null;
    }
};
