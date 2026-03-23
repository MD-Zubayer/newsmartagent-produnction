// app/(main)/docs/DocsContext.jsx
"use client";
import React, { createContext, useContext, useState } from 'react';

const DocsContext = createContext();

export function DocsProvider({ children }) {
  const [lang, setLang] = useState('en');
  const [supportEmail, setSupportEmail] = useState('support@newsmartagent.com');

  React.useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.newsmartagent.com'}/api/settings/public-settings/`)
      .then(res => res.json())
      .then(data => {
        if (data.support_email) {
          setSupportEmail(data.support_email);
        }
      })
      .catch(err => console.error('Error fetching support email:', err));
  }, []);

  return (
    <DocsContext.Provider value={{ lang, setLang, supportEmail }}>
      {children}
    </DocsContext.Provider>
  );
}

export function useDocs() {
  return useContext(DocsContext);
}
