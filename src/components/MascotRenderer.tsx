/* Loaded on demand by ./Mascot.tsx — keeps the avatar engine out of the first download. */
import { createAvatar, type AvatarHandle } from '@bible-strong/avatar-react';
import { useImperativeHandle, useRef, type MutableRefObject } from 'react';
import kroo from '@/assets/kroo.avatar.json';
import type { MascotProps } from './Mascot';

// Checks the character file once.
const Kroo = createAvatar(kroo);

type Props = Omit<MascotProps, 'onClick' | 'label' | 'className' | 'style'> & {
  size: number;
  ariaLabel: string;
  pokeRef: MutableRefObject<((g: 'nod' | 'bounce' | 'spin') => void) | null>;
};

export default function MascotRenderer({ state = 'idle', size, followPointer, settleAfterMs, ariaLabel, pokeRef }: Props) {
  const handle = useRef<AvatarHandle>(null);
  useImperativeHandle(pokeRef, () => (g) => handle.current?.poke(g), []);
  return <Kroo ref={handle} state={state} size={size} followPointer={followPointer} settleAfterMs={settleAfterMs} ariaLabel={ariaLabel} />;
}
