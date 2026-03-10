"use client";

import React, { useRef, useState } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { Float, PerspectiveCamera, OrbitControls } from "@react-three/drei";

export default function FloatingImage({ 
  imgUrl, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  floatIntensity = 1,
  rotationIntensity = 1,
  speed = 1
}) {
  const meshRef = useRef();
  const texture = useLoader(THREE.TextureLoader, imgUrl);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      // Subtle pulse when hovered
      const targetScale = hovered ? 1.1 : 1;
      meshRef.current.scale.lerp(
        new THREE.Vector3(scale[0] * targetScale, scale[1] * targetScale, scale[2] * targetScale), 
        0.1
      );
    }
  });

  // Calculate aspect ratio to maintain image proportions
  const width = texture.image.width;
  const height = texture.image.height;
  const aspect = width / height;

  return (
    <Float
      speed={speed * 2} 
      rotationIntensity={rotationIntensity} 
      floatIntensity={floatIntensity}
    >
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[aspect * 3, 3]} />
        <meshBasicMaterial 
          map={texture} 
          transparent={true} 
          side={THREE.DoubleSide}
          alphaTest={0.5}
        />
      </mesh>
    </Float>
  );
}
