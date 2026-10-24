import React from 'react';

interface TypingIndicatorProps {
  name?: string;
  className?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ name, className = '' }) => {
  return (
    <div className={`flex items-center space-x-2 text-xs font-semibold text-[#0E2A6E] dark:text-[#3D6FE0] animate-fade-in ${className}`}>
      {name && <span>{name} is typing</span>}
      <div className="flex items-center space-x-1 py-1" aria-label="Typing indicator">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0E2A6E] dark:bg-[#3D6FE0] animate-bounce [animation-delay:-0.32s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#0E2A6E] dark:bg-[#3D6FE0] animate-bounce [animation-delay:-0.16s]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#0E2A6E] dark:bg-[#3D6FE0] animate-bounce" />
      </div>
    </div>
  );
};
