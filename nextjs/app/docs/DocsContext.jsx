// app/(main)/docs/DocsContext.jsx
"use client";
import React, { createContext, useContext, useState } from 'react';

const DocsContext = createContext();

export function DocsProvider({ children }) {
  const [lang, setLang] = useState('bn');

  return (
    <DocsContext.Provider value={{ lang, setLang }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  return useContext(DocsContext);
}
