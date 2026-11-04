/**
 * Logotipo e símbolo oficiais da Optsolv, servidos a partir dos PNGs exportados do PDF original.
 * Nunca recolorir, distorcer ou recriar: só escolhemos a variante adequada ao fundo.
 * O <img> fica dentro de um wrapper inline para nunca ser esticado por um container flex.
 */
type Props = { variant?: 'laranja' | 'claro' | 'preto'; height?: number; className?: string; center?: boolean };

export function Logo({ variant = 'laranja', height = 28, className, center }: Props) {
  return (
    <span className={`inline-flex shrink-0 max-w-full ${center ? 'justify-center' : ''}`}>
      <img src={`/marca/logo_${variant}.png`} alt="Optsolv" className={className} style={{ height: height || undefined, width: 'auto', maxWidth: '100%', objectFit: 'contain', flex: 'none' }} draggable={false} />
    </span>
  );
}

export function Symbol({ variant = 'laranja', height = 28, className }: Props) {
  return (
    <span className="inline-flex shrink-0">
      <img src={`/marca/simbolo_${variant}.png`} alt="" aria-hidden className={className} style={{ height: height || undefined, width: 'auto', objectFit: 'contain', flex: 'none' }} draggable={false} />
    </span>
  );
}
