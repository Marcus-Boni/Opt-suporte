import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Ensina ao tailwind-merge os tamanhos extras da escala (styles.css): sem isto, text-md/text-2xs
// seriam lidos como cor e um `text-ink` posterior apagaria o tamanho.
const twMerge = extendTailwindMerge({ extend: { theme: { text: ['2xs', 'md'] } } });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
