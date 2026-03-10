"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, ContactShadows } from "@react-three/drei";

export default function ThreeScene({ children, className = "h-full w-full" }) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} />
        
        <Suspense fallback={null}>
          {children}
          <Environment preset="city" />
        </Suspense>

        <ContactShadows 
          position={[0, -3.5, 0]} 
          opacity={0.4} 
          scale={20} 
          blur={2} 
          far={4.5} 
        />
      </Canvas>
    </div>
  );
}
