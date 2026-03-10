// nextjs/mdx-components.jsx
export function useMDXComponents(components) {
  return {
    h1: ({ children }) => (
      <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-[1.2] mb-6">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tight mt-12 mb-6">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xl font-black text-gray-800 italic mt-8 mb-4">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-lg text-gray-600 font-medium leading-relaxed mb-6">
        {children}
      </p>
    ),
    ul: ({ children }) => (
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {children}
      </ul>
    ),
    li: ({ children }) => (
      <li className="bg-white p-5 rounded-[1.5rem] border border-gray-100 shadow-sm flex items-start gap-3">
        <div className="w-2 h-2 mt-2 bg-indigo-600 rounded-full flex-shrink-0" />
        <div className="text-sm text-gray-600 font-medium">{children}</div>
      </li>
    ),
    strong: ({ children }) => (
      <strong className="font-black text-gray-900">{children}</strong>
    ),
    a: ({ children, href }) => (
      <a href={href} className="text-indigo-600 underline font-bold hover:text-indigo-800 transition-colors">
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <div className="bg-indigo-50/50 p-6 md:p-10 rounded-[2.5rem] border border-gray-100 mb-8 border-l-4 border-l-indigo-600">
        {children}
      </div>
    ),
    ...components,
  }
}
