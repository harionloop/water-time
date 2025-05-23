'use client';

import { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

interface HumanModel3DProps {
    bodyType: string;
    waterLevel: number;
}

function Model({ bodyType, waterLevel }: HumanModel3DProps) {
    // Basic human shape using a cylinder for body and sphere for head
    return (
        <group>
            {/* Head */}
            <mesh position={[0, 2, 0]}>
                <sphereGeometry args={[0.5, 32, 32]} />
                <meshStandardMaterial color="#f0f0f0" />
            </mesh>

            {/* Body */}
            <mesh position={[0, 0, 0]}>
                <cylinderGeometry 
                    args={[
                        bodyType === 'slim' ? 0.4 : bodyType === 'muscular' ? 0.8 : 0.6, // radius top
                        bodyType === 'slim' ? 0.3 : bodyType === 'muscular' ? 0.7 : 0.5, // radius bottom
                        3, // height
                        32 // segments
                    ]} 
                />
                <meshStandardMaterial color="#f0f0f0" />
            </mesh>

            {/* Water Level Indicator */}
            <mesh position={[0, -1.5 + (waterLevel / 100) * 3, 0]}>
                <cylinderGeometry 
                    args={[
                        bodyType === 'slim' ? 0.41 : bodyType === 'muscular' ? 0.81 : 0.61,
                        bodyType === 'slim' ? 0.31 : bodyType === 'muscular' ? 0.71 : 0.51,
                        (waterLevel / 100) * 3,
                        32
                    ]} 
                />
                <meshStandardMaterial 
                    color={waterLevel < 30 ? '#ef4444' : waterLevel < 60 ? '#f97316' : '#60a5fa'}
                    transparent={true}
                    opacity={0.7}
                />
            </mesh>
        </group>
    );
}

export default function HumanModel3D({ bodyType, waterLevel }: HumanModel3DProps) {
    return (
        <div className="w-full h-[450px]">
            <Canvas camera={{ position: [0, 0, 5], fov: 75 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} />
                <Model bodyType={bodyType} waterLevel={waterLevel} />
                <OrbitControls 
                    enablePan={false}
                    minDistance={3}
                    maxDistance={7}
                    minPolarAngle={Math.PI/4}
                    maxPolarAngle={Math.PI/1.5}
                />
            </Canvas>
        </div>
    );
} 