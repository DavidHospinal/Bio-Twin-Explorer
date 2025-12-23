import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';
import { ExtrudedTissue } from './ExtrudedTissue';

interface BioTwinSceneProps {
    cursorX: number;
    cursorY: number;
    isPinching: boolean;
    isGrabbing: boolean;
    tissueShapes?: THREE.Shape[];
}

// Componente de cursor 3D que sigue la posicion de la mano
const HandCursor3D = ({ x, y, isPinching }: { x: number; y: number; isPinching: boolean }) => {
    const posX = (x - 0.5) * 12;
    const posY = (0.5 - y) * 8;

    return (
        <mesh position={[posX, posY, 2]}>
            <sphereGeometry args={[isPinching ? 0.8 : 0.5, 32, 32]} />
            <meshStandardMaterial
                color={isPinching ? "#22c55e" : "#06b6d4"}
                emissive={isPinching ? "#22c55e" : "#06b6d4"}
                emissiveIntensity={0.8}
                transparent
                opacity={0.9}
            />
        </mesh>
    );
};

// Tejido 3D placeholder con rotacion animada
const PlaceholderTissue = () => {
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((_, delta) => {
        if (meshRef.current) {
            meshRef.current.rotation.y += delta * 0.5;
            meshRef.current.rotation.x += delta * 0.2;
        }
    });

    return (
        <mesh ref={meshRef} position={[0, 0, 0]}>
            <torusKnotGeometry args={[2, 0.6, 128, 32]} />
            <meshStandardMaterial
                color="#8b5cf6"
                roughness={0.2}
                metalness={0.8}
                emissive="#8b5cf6"
                emissiveIntensity={0.2}
            />
        </mesh>
    );
};

export const BioTwinScene = ({ cursorX, cursorY, isPinching, tissueShapes }: BioTwinSceneProps) => {
    const hasShapes = tissueShapes && tissueShapes.length > 0;

    return (
        <div className="w-full h-full min-h-[300px]">
            <Canvas
                camera={{ position: [0, 0, 10], fov: 60 }}
                style={{ background: 'linear-gradient(to bottom, #0f172a, #1e293b)' }}
            >
                {/* Iluminacion */}
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1.5} />
                <pointLight position={[-10, -10, -5]} color="#06b6d4" intensity={1} />
                <pointLight position={[10, 10, 10]} color="#ec4899" intensity={0.5} />

                {/* Controles */}
                <OrbitControls
                    enableZoom={true}
                    enablePan={true}
                    autoRotate={false}
                />

                {/* Grid de referencia */}
                <Grid
                    args={[30, 30]}
                    position={[0, -4, 0]}
                    cellSize={1}
                    cellThickness={0.5}
                    cellColor="#334155"
                    sectionSize={5}
                    sectionThickness={1}
                    sectionColor="#475569"
                    fadeDistance={30}
                    fadeStrength={1}
                    followCamera={false}
                />

                {/* Cursor 3D que sigue la mano */}
                <HandCursor3D x={cursorX} y={cursorY} isPinching={isPinching} />

                {/* Tejido segmentado o placeholder */}
                {hasShapes ? (
                    <ExtrudedTissue
                        shapes={tissueShapes}
                        depth={0.8}
                        color="#ec4899"
                        position={[0, 0, 0]}
                    />
                ) : (
                    <PlaceholderTissue />
                )}
            </Canvas>

            {/* Instrucciones */}
            <div className="absolute top-2 left-2 text-xs text-slate-400 bg-black/50 p-2 rounded">
                Arrastra para rotar | Scroll para zoom
            </div>
        </div>
    );
};
