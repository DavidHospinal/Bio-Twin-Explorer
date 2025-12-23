import * as ort from 'onnxruntime-web';

// Configurar rutas WASM
ort.env.wasm.wasmPaths = '/';

let encoderSession: ort.InferenceSession | null = null;
let decoderSession: ort.InferenceSession | null = null;
let imageEmbedding: ort.Tensor | null = null;

// Escuchar mensajes del hilo principal
self.onmessage = async (event: MessageEvent) => {
    const { type, payload } = event.data;

    try {
        switch (type) {
            case 'LOAD_MODELS':
                await loadModels();
                break;
            case 'RUN_ENCODER':
                await runEncoder(payload.tensorData, payload.shape);
                break;
            case 'RUN_DECODER':
                await runDecoder(payload.x, payload.y);
                break;
        }
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            payload: { message: error instanceof Error ? error.message : 'Unknown error' }
        });
    }
};

async function loadModels() {
    self.postMessage({ type: 'STATUS', payload: { status: 'Loading Encoder...' } });

    const sessionOptions: ort.InferenceSession.SessionOptions = {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
    };

    if (!encoderSession) {
        encoderSession = await ort.InferenceSession.create(
            '/models/sam_vit_b_01ec64.quant.encoder.onnx',
            sessionOptions
        );
    }

    self.postMessage({ type: 'STATUS', payload: { status: 'Loading Decoder...' } });

    if (!decoderSession) {
        decoderSession = await ort.InferenceSession.create(
            '/models/sam_vit_b_01ec64.quant.decoder.onnx',
            sessionOptions
        );
    }

    self.postMessage({ type: 'STATUS', payload: { status: 'Models Loaded' } });
    self.postMessage({ type: 'MODELS_LOADED' });
}

async function runEncoder(tensorData: Float32Array, shape: number[]) {
    if (!encoderSession) {
        throw new Error('Encoder not loaded');
    }

    self.postMessage({ type: 'STATUS', payload: { status: 'Encoding Image...' } });

    const inputTensor = new ort.Tensor('float32', tensorData, shape);
    const feeds = { input_image: inputTensor };
    const results = await encoderSession.run(feeds);

    imageEmbedding = results.image_embeddings;

    self.postMessage({ type: 'STATUS', payload: { status: 'Embedding Ready' } });
    self.postMessage({ type: 'ENCODER_COMPLETE' });
}

async function runDecoder(x: number, y: number) {
    if (!decoderSession || !imageEmbedding) {
        throw new Error('Decoder or embedding not ready');
    }

    const pointCoords = new Float32Array([x * 1024, y * 1024]);
    const pointLabels = new Float32Array([1]);

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
    const masks = results.masks;

    self.postMessage({
        type: 'DECODER_COMPLETE',
        payload: {
            maskData: masks.data as Float32Array,
            dims: masks.dims
        }
    });
}

export { };
