import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ImagePlane3DProps {
    imageSrc: string;
    particles: Float32Array | null;
    isExploded: boolean;
    rotation: { x: number; y: number };
}

export const ImagePlane3D = ({ imageSrc, particles, isExploded, rotation }: ImagePlane3DProps) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const pointsRef = useRef<THREE.Points>(null);

    // Cargar textura de imagen
    useEffect(() => {
        if (imageSrc) {
            const loader = new THREE.TextureLoader();
            loader.load(imageSrc, (texture) => {
                if (meshRef.current) {
                    (meshRef.current.material as THREE.MeshStandardMaterial).map = texture;
                    (meshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
                }
            });
        }
    }, [imageSrc]);

    // Geometria de particulas
    const particleGeometry = useMemo(() => {
        if (!particles || particles.length === 0) return null;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));

        // Guardar posiciones originales
        const originalPositions = new Float32Array(particles);
        geometry.setAttribute('originalPosition', new THREE.BufferAttribute(originalPositions, 3));

        return geometry;
    }, [particles]);

    // Animacion de explosion/reunion
    useFrame((_, delta) => {
        if (meshRef.current) {
            // Aplicar rotacion desde gestos
            meshRef.current.rotation.x = rotation.x;
            meshRef.current.rotation.y = rotation.y;

            // Fade de opacidad segun explosion
            const material = meshRef.current.material as THREE.MeshStandardMaterial;
            if (isExploded) {
                material.opacity = Math.max(0, material.opacity - delta * 2);
            } else {
                material.opacity = Math.min(1, material.opacity + delta * 2);
            }
        }

        if (pointsRef.current && particleGeometry) {
            pointsRef.current.rotation.x = rotation.x;
            pointsRef.current.rotation.y = rotation.y;

            const positions = particleGeometry.getAttribute('position') as THREE.BufferAttribute;
            const originals = particleGeometry.getAttribute('originalPosition') as THREE.BufferAttribute;

            for (let i = 0; i < positions.count; i++) {
                const ox = originals.getX(i);
                const oy = originals.getY(i);
                const oz = originals.getZ(i);

                if (isExploded) {
                    // Explotar hacia afuera
                    const targetX = ox * 3 + (Math.random() - 0.5) * 2;
                    const targetY = oy * 3 + (Math.random() - 0.5) * 2;
                    const targetZ = oz + (Math.random() - 0.5) * 5;

                    positions.setX(i, positions.getX(i) + (targetX - positions.getX(i)) * delta * 2);
                    positions.setY(i, positions.getY(i) + (targetY - positions.getY(i)) * delta * 2);
                    positions.setZ(i, positions.getZ(i) + (targetZ - positions.getZ(i)) * delta * 2);
                } else {
                    // Reunir hacia posicion original
                    positions.setX(i, positions.getX(i) + (ox - positions.getX(i)) * delta * 3);
                    positions.setY(i, positions.getY(i) + (oy - positions.getY(i)) * delta * 3);
                    positions.setZ(i, positions.getZ(i) + (oz - positions.getZ(i)) * delta * 3);
                }
            }
            positions.needsUpdate = true;

            // Ajustar opacidad de particulas
            const pointMaterial = pointsRef.current.material as THREE.PointsMaterial;
            if (isExploded) {
                pointMaterial.opacity = Math.min(1, pointMaterial.opacity + delta * 2);
            } else {
                pointMaterial.opacity = Math.max(0, pointMaterial.opacity - delta * 2);
            }
        }
    });

    return (
        <group>
            {/* Plano con la imagen */}
            <mesh ref={meshRef} position={[0, 0, 0]}>
                <planeGeometry args={[6, 4.5]} />
                <meshStandardMaterial
                    color="#ffffff"
                    side={THREE.DoubleSide}
                    transparent
                    opacity={1}
                />
            </mesh>

            {/* Sistema de particulas */}
            {particleGeometry && (
                <points ref={pointsRef}>
                    <bufferGeometry attach="geometry" {...particleGeometry} />
                    <pointsMaterial
                        size={0.08}
                        color="#ec4899"
                        transparent
                        opacity={0}
                        sizeAttenuation
                    />
                </points>
            )}
        </group>
    );
};
