import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { petSoundRate, type SoundPet } from "@/lib/pet-sound";
import catAudio from "@/assets/cat-meow.mp3.asset.json";
import dogAudio from "@/assets/dog-bark.mp3.asset.json";

const SoundContext = createContext({ enabled: true, toggle: () => {}, play: (_pet: SoundPet) => {} });

export function PetSoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); }, []);
  const play = useCallback((pet: SoundPet) => {
    if (!enabled || document.hidden) return;
    audio.current?.pause();
    const next = new Audio(pet.species === "CAT" ? catAudio.url : dogAudio.url);
    next.volume = 0.35;
    next.preservesPitch = false;
    next.playbackRate = petSoundRate(pet);
    audio.current = next;
    // Only called by user gestures; never force autoplay or mutate trial state.
    void next.play().catch(() => { toast("Sound couldn't play. Tap the pet to try again."); });
  }, [enabled]);
  const toggle = () => {
    audio.current?.pause();
    setEnabled((value) => !value);
  };
  return <SoundContext.Provider value={{ enabled, toggle, play }}>{children}</SoundContext.Provider>;
}

export const usePetSound = () => useContext(SoundContext);

export function PetSoundToggle() {
  const { enabled, toggle } = usePetSound();
  return <Button variant="outline" size="icon" onClick={toggle} aria-label={enabled ? "Mute pet sounds" : "Enable pet sounds"} aria-pressed={enabled} title={enabled ? "Mute pet sounds" : "Enable pet sounds"} className="rounded-full">
    {enabled ? <Volume2 /> : <VolumeX />}
  </Button>;
}